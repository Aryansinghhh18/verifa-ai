from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TestCase(BaseModel):
    """Structured test case definition for predefined benchmark suites."""
    test_id: str = Field(..., description="Unique test case identifier (e.g. HL-001)")
    category: str = Field(..., description="Test category, e.g. factual_knowledge, safety, instruction_following")
    prompt: str = Field(..., min_length=1, description="The test input prompt sent to the chatbot")
    expected_answer: Optional[str] = Field(default=None, description="Ground truth or reference baseline for factual comparison")
    evaluation_type: str = Field(..., description="Metric type: hallucination, toxicity, consistency, instruction_following, adversarial")
    severity: str = Field(default="medium", description="Risk severity if test fails: low, medium, high, critical")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context, domain tags, or evaluation parameters")


class TestSuiteInfo(BaseModel):
    """Metadata describing a predefined test suite."""
    id: str = Field(..., description="Suite machine key (e.g. 'full', 'hallucination')")
    name: str = Field(..., description="Human-readable suite name")
    description: str = Field(..., description="High-level description of what this suite evaluates")
    categories: List[str] = Field(default_factory=list, description="Subcategories covered in this suite")
    total_available_tests: int = Field(default=150, description="Total predefined tests available in library")
    default_test_count: int = Field(default=100, description="Recommended number of tests to execute")
    min_tests: int = Field(default=10, description="Minimum allowable tests")
    max_tests: int = Field(default=150, description="Maximum allowable tests")
    badge: Optional[str] = Field(default=None, description="UI badge, e.g. 'RECOMMENDED', 'CORE'")


class TestRunConfigRequest(BaseModel):
    """Configuration payload submitted by the user to configure or launch a TestLab run."""
    chatbot_id: Optional[str] = Field(default=None, description="Optional ID of existing registered chatbot")
    chatbot_name: str = Field(..., min_length=1, max_length=100, description="Name of the chatbot under test")
    api_endpoint: str = Field(..., min_length=4, description="Target chatbot HTTP/HTTPS endpoint URL")
    api_key: Optional[str] = Field(default=None, description="API Key or Bearer token (encrypted and handled in memory only)")
    test_suite: str = Field(
        default="full",
        description="Selected test suite: 'full', 'hallucination', 'toxicity', 'consistency', 'instruction_following', 'adversarial'"
    )
    test_count: int = Field(
        default=100,
        ge=10,
        le=150,
        description="Number of benchmark tests to execute (target 100-150)"
    )


class TestRunConfigValidationResponse(BaseModel):
    """Response verifying whether a test run configuration is valid."""
    valid: bool
    message: str
    chatbot_name: str
    api_endpoint: str
    selected_suite: str
    suite_display_name: str
    test_count: int
    estimated_duration_sec: int


class TestItemResult(BaseModel):
    """Standardized single test case result schema for TestLab."""
    run_id: str
    test_id: str
    category: str
    prompt: str
    chatbot_response: str
    reference_information: Optional[str] = None
    evaluation_type: str
    score: Optional[float] = None
    threshold: Optional[float] = None
    status: str = Field(..., description="Result state: PASS, POTENTIAL ISSUE, EXECUTION ERROR")
    reason: str
    severity: str = "medium"
    execution_status: str = "Success"
    latency_ms: Optional[float] = 0.0
    timestamp: str


class TestLabRunProgress(BaseModel):
    """Real-time progress telemetry for an active TestLab run."""
    run_id: str
    chatbot_name: str
    test_suite: str
    status: str
    total_tests: int
    completed_tests: int
    passed_tests: int
    potential_issue_tests: int
    failed_tests: int
    current_test_index: int
    current_test_name: str
    duration_seconds: Optional[float] = 0.0


class TestLabRunHistoryItem(BaseModel):
    """Summary item for the TestLab Run History list."""
    id: str
    chatbot_name: str
    test_suite: str
    status: str
    total_tests: int
    completed_tests: int
    passed_tests: int
    potential_issue_tests: int
    failed_tests: int
    duration_seconds: Optional[float] = None
    potential_hallucination_rate: Optional[float] = 0.0
    toxicity_rate: Optional[float] = 0.0
    created_at: datetime


class TestLabRunResponse(BaseModel):
    """Full detail view of a completed or active TestLab run."""
    id: str
    user_id: str
    chatbot_id: Optional[str] = None
    chatbot_name: str
    api_endpoint: str
    test_suite: str
    total_tests: int
    completed_tests: int
    passed_tests: int
    potential_issue_tests: int
    failed_tests: int
    status: str
    current_test_index: int
    current_test_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    summary_metrics: Dict[str, Any] = Field(default_factory=dict)
    results: List[TestItemResult] = Field(default_factory=list)
    created_at: datetime
