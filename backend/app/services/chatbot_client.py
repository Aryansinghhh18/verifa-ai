import ipaddress
import json
import logging
import time
from urllib.parse import urlparse
from typing import Any, Dict, Optional, Tuple
import httpx

from app.config import settings
from app.core.security import decrypt_api_key

logger = logging.getLogger("verifa.services.chatbot_client")

# Disallowed IP ranges for SSRF mitigation
DISALLOWED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # Loopback
    ipaddress.ip_network("10.0.0.0/8"),       # RFC 1918 Private
    ipaddress.ip_network("172.16.0.0/12"),    # RFC 1918 Private
    ipaddress.ip_network("192.168.0.0/16"),   # RFC 1918 Private
    ipaddress.ip_network("169.254.0.0/16"),   # Link-Local / Cloud Metadata
    ipaddress.ip_network("::1/128"),          # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 Unique Local
]


class ChatbotClientError(Exception):
    pass


class ChatbotSSRFError(ChatbotClientError):
    pass


def validate_endpoint_url(url: str, allow_local: bool = False) -> None:
    """Validates endpoint URL to prevent Server-Side Request Forgery (SSRF)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ChatbotSSRFError(f"Invalid URL scheme '{parsed.scheme}'. Only http and https are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ChatbotSSRFError("Invalid URL: missing hostname.")

    if not allow_local:
        # Check if hostname is an IP literal
        try:
            ip = ipaddress.ip_address(hostname)
            for disallowed in DISALLOWED_NETWORKS:
                if ip in disallowed:
                    raise ChatbotSSRFError(f"Access to private/local address '{hostname}' is forbidden for security.")
        except ValueError:
            # Hostname is a domain name, disallow explicit 'localhost'
            if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0"):
                raise ChatbotSSRFError("Access to localhost is forbidden for security.")


def extract_json_path(data: Any, path: str) -> str:
    """Extracts a string from nested JSON using dot / bracket notation.

    Examples:
        'choices[0].message.content'
        'data.answer'
        'response'
    """
    if not path or not data:
        return str(data)

    current = data
    # Normalize paths like choices[0].message.content -> ['choices', 0, 'message', 'content']
    tokens = []
    part = ""
    i = 0
    while i < len(path):
        char = path[i]
        if char == ".":
            if part:
                tokens.append(part)
                part = ""
        elif char == "[":
            if part:
                tokens.append(part)
                part = ""
            # parse index until ]
            j = path.find("]", i)
            if j != -1:
                idx_str = path[i + 1:j]
                try:
                    tokens.append(int(idx_str))
                except ValueError:
                    tokens.append(idx_str)
                i = j
        else:
            part += char
        i += 1
    if part:
        tokens.append(part)

    for token in tokens:
        if isinstance(token, int) and isinstance(current, list):
            if 0 <= token < len(current):
                current = current[token]
            else:
                raise ChatbotClientError(f"Index {token} out of range in response list")
        elif isinstance(current, dict):
            if token in current:
                current = current[token]
            else:
                raise ChatbotClientError(f"Key '{token}' not found in chatbot response")
        else:
            raise ChatbotClientError(f"Cannot traverse token '{token}' on type {type(current).__name__}")

    return str(current) if current is not None else ""


class ChatbotClient:
    """Outbound client for interacting with user chatbot/LLM endpoints.

    Strictly protects external API keys:
    - Decrypts key in-memory immediately before outbound request.
    - Never logs keys or displays them in error messages.
    """

    def __init__(self, timeout_seconds: Optional[int] = None):
        self._timeout = timeout_seconds or settings.REQUEST_TIMEOUT_SECONDS

    async def call_chatbot(
        self,
        endpoint_url: str,
        encrypted_api_key: str,
        prompt: str,
        http_method: str = "POST",
        request_template: Optional[str] = None,
        response_json_path: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None,
        allow_local_urls: bool = False
    ) -> Tuple[str, int, float]:
        """Calls external chatbot endpoint with user prompt.

        Returns:
            Tuple of (extracted_response_text, http_status_code, latency_ms)
        """
        validate_endpoint_url(endpoint_url, allow_local=allow_local_urls)

        # Decrypt API key in memory only for request execution (never logged!)
        plain_key = decrypt_api_key(encrypted_api_key) if encrypted_api_key else ""

        # Replace API key placeholders if present in endpoint URL (e.g. ?key=YOUR_API_KEY or ?key={{api_key}})
        if plain_key:
            if "YOUR_API_KEY" in endpoint_url:
                endpoint_url = endpoint_url.replace("YOUR_API_KEY", plain_key)
            if "{{api_key}}" in endpoint_url:
                endpoint_url = endpoint_url.replace("{{api_key}}", plain_key)

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "VeriFA-AI-Evaluation-Harness/1.0"
        }
        if plain_key:
            # Google APIs (Gemini) use 'x-goog-api-key' instead of 'Authorization: Bearer'
            if "generativelanguage.googleapis.com" in endpoint_url or "googleapis.com" in endpoint_url:
                headers["x-goog-api-key"] = plain_key
            else:
                headers["Authorization"] = f"Bearer {plain_key}"

        if custom_headers:
            headers.update(custom_headers)

        # Prepare payload
        template = request_template or '{"messages": [{"role": "user", "content": "{{prompt}}"}]}'
        # Substitute prompt safely using JSON serialization
        json_prompt = json.dumps(prompt)[1:-1]  # escape inner quotes and newlines
        payload_str = template.replace("{{prompt}}", json_prompt)
        
        try:
            payload = json.loads(payload_str)
        except json.JSONDecodeError as e:
            raise ChatbotClientError(f"Request template could not be parsed as valid JSON: {str(e)}")

        start_time = time.perf_counter()
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            try:
                if http_method.upper() == "POST":
                    response = await client.post(endpoint_url, json=payload, headers=headers)
                elif http_method.upper() == "GET":
                    response = await client.get(endpoint_url, params={"prompt": prompt}, headers=headers)
                else:
                    raise ChatbotClientError(f"Unsupported HTTP method: {http_method}")

                end_time = time.perf_counter()
                latency_ms = (end_time - start_time) * 1000.0

                if response.status_code >= 400:
                    error_preview = response.text[:200]
                    raise ChatbotClientError(
                        f"Chatbot endpoint returned HTTP {response.status_code}: {error_preview}"
                    )

                response_data = response.json()
                path = response_json_path or "choices[0].message.content"
                extracted_text = extract_json_path(response_data, path)

                return extracted_text, response.status_code, latency_ms

            except httpx.TimeoutException:
                end_time = time.perf_counter()
                latency_ms = (end_time - start_time) * 1000.0
                raise ChatbotClientError(f"Chatbot endpoint timed out after {self._timeout}s.")
            except httpx.RequestError as e:
                end_time = time.perf_counter()
                latency_ms = (end_time - start_time) * 1000.0
                raise ChatbotClientError(f"Network error connecting to chatbot: {str(e)}")
