import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.schemas.testlab import (
    TestCase,
    TestSuiteInfo,
    TestRunConfigRequest,
    TestRunConfigValidationResponse,
)
from app.services.chatbot_client import validate_endpoint_url, ChatbotSSRFError

logger = logging.getLogger("verifa.services.testlab")

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "testlab"


class TestLabDatasetService:
    """Manages predefined benchmark test suites, dataset metadata, and configuration validation.

    Ensures test data is stored server-side and never hardcoded in client bundles.
    """

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or DATA_DIR
        self._suites_catalog: Optional[List[TestSuiteInfo]] = None
        self._seed_testcases: Optional[List[TestCase]] = None

    def get_suites(self) -> List[TestSuiteInfo]:
        """Loads and returns all available predefined benchmark test suites."""
        if self._suites_catalog is not None:
            return self._suites_catalog

        catalog_path = self.data_dir / "suites_catalog.json"
        if not catalog_path.exists():
            logger.warning(f"Suites catalog not found at {catalog_path}. Returning fallback catalog.")
            return [
                TestSuiteInfo(
                    id="full",
                    name="Full Evaluation",
                    description="Comprehensive multi-dimensional evaluation covering all benchmark categories.",
                    categories=["factual_accuracy", "safety", "consistency", "instruction_following", "adversarial"],
                    total_available_tests=150,
                    default_test_count=100,
                    badge="DEFAULT (RECOMMENDED)"
                )
            ]

        try:
            with open(catalog_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                self._suites_catalog = [TestSuiteInfo(**item) for item in raw_data]
                return self._suites_catalog
        except Exception as e:
            logger.error(f"Error loading suites catalog: {str(e)}", exc_info=True)
            return []

    def get_suite_by_id(self, suite_id: str) -> Optional[TestSuiteInfo]:
        """Finds a specific suite by its key."""
        suites = self.get_suites()
        return next((s for s in suites if s.id.lower() == suite_id.lower()), None)

    def get_all_testcases(self) -> List[TestCase]:
        """Loads all test cases from the primary benchmark dataset."""
        if self._seed_testcases is not None and len(self._seed_testcases) > 10:
            return self._seed_testcases

        cases_path = self.data_dir / "dataset_120.json"
        if not cases_path.exists():
            cases_path = self.data_dir / "testcases_seed.json"

        if not cases_path.exists():
            return []

        try:
            with open(cases_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                self._seed_testcases = [TestCase(**item) for item in raw_data]
                return self._seed_testcases
        except Exception as e:
            logger.error(f"Error loading benchmark testcases: {str(e)}", exc_info=True)
            return []

    def get_sample_testcases(self, limit: int = 10) -> List[TestCase]:
        """Returns sample test case definitions showcasing the architecture."""
        all_cases = self.get_all_testcases()
        return all_cases[:limit]

    def get_testcases_for_suite(self, suite_id: str = "full", limit: int = 100) -> List[TestCase]:
        """Returns filtered test cases for a specific test suite up to requested count."""
        all_cases = self.get_all_testcases()
        if not all_cases:
            return []

        s_id = (suite_id or "full").lower()
        if s_id == "full":
            return all_cases[:limit]
        elif s_id == "hallucination":
            filtered = [c for c in all_cases if c.category.lower() in ("hallucination", "factual accuracy", "false premise")]
        elif s_id == "toxicity":
            filtered = [c for c in all_cases if c.category.lower() in ("toxicity", "toxicity/safety")]
        elif s_id == "consistency":
            filtered = [c for c in all_cases if c.category.lower() == "consistency"]
        elif s_id == "instruction_following":
            filtered = [c for c in all_cases if c.category.lower() == "instruction following"]
        elif s_id == "adversarial":
            filtered = [c for c in all_cases if c.category.lower() == "adversarial"]
        else:
            filtered = all_cases

        # If filtered set is smaller than requested limit, backfill with other cases
        if len(filtered) < limit:
            remaining = [c for c in all_cases if c not in filtered]
            filtered.extend(remaining[: limit - len(filtered)])

        return filtered[:limit]

    def validate_configuration(self, config: TestRunConfigRequest) -> TestRunConfigValidationResponse:
        """Validates configuration parameters for a future TestLab test run.

        Checks:
        1. SSRF and URL safety of chatbot endpoint.
        2. Recognized test suite selection.
        3. Test count within target range (10-150, target: 100-150).
        """
        # 1. URL & SSRF Validation
        try:
            validate_endpoint_url(config.api_endpoint)
        except ChatbotSSRFError as ssrf_err:
            return TestRunConfigValidationResponse(
                valid=False,
                message=f"Endpoint URL rejected: {str(ssrf_err)}",
                chatbot_name=config.chatbot_name,
                api_endpoint=config.api_endpoint,
                selected_suite=config.test_suite,
                suite_display_name=config.test_suite,
                test_count=config.test_count,
                estimated_duration_sec=0
            )
        except Exception as err:
            return TestRunConfigValidationResponse(
                valid=False,
                message=f"Invalid endpoint format: {str(err)}",
                chatbot_name=config.chatbot_name,
                api_endpoint=config.api_endpoint,
                selected_suite=config.test_suite,
                suite_display_name=config.test_suite,
                test_count=config.test_count,
                estimated_duration_sec=0
            )

        # 2. Test Suite Validation
        suite = self.get_suite_by_id(config.test_suite)
        if not suite:
            return TestRunConfigValidationResponse(
                valid=False,
                message=f"Unknown test suite '{config.test_suite}'. Available options: Full Evaluation, Hallucination, Toxicity, Consistency, Instruction Following, Adversarial.",
                chatbot_name=config.chatbot_name,
                api_endpoint=config.api_endpoint,
                selected_suite=config.test_suite,
                suite_display_name=config.test_suite,
                test_count=config.test_count,
                estimated_duration_sec=0
            )

        # 3. Test Count Bounds Check (Target: 100-150)
        if config.test_count < suite.min_tests or config.test_count > suite.max_tests:
            return TestRunConfigValidationResponse(
                valid=False,
                message=f"Test count must be between {suite.min_tests} and {suite.max_tests} for suite '{suite.name}'.",
                chatbot_name=config.chatbot_name,
                api_endpoint=config.api_endpoint,
                selected_suite=suite.id,
                suite_display_name=suite.name,
                test_count=config.test_count,
                estimated_duration_sec=0
            )

        # Calculate estimated duration (assuming ~1.2s per test average)
        est_sec = int(config.test_count * 1.2)

        return TestRunConfigValidationResponse(
            valid=True,
            message="Configuration verified successfully. Ready for automated test execution.",
            chatbot_name=config.chatbot_name,
            api_endpoint=config.api_endpoint,
            selected_suite=suite.id,
            suite_display_name=suite.name,
            test_count=config.test_count,
            estimated_duration_sec=est_sec
        )


testlab_service = TestLabDatasetService()
