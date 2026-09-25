import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.database import init_db
from app.evaluators.hallucination import VectaraHallucinationEvaluator
from app.evaluators.registry import EvaluationRegistry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("verifa.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context:

    1. Initializes database tables.
    2. Loads Vectara HHEM Hugging Face model once into memory on startup.
    3. Builds the singleton EvaluationRegistry and attaches to app.state.
    """
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    
    # Step 1: Initialize database
    logger.info("Initializing database schema...")
    await init_db()
    logger.info("Database initialized.")

    # Step 2: Warm up ML models (loaded ONCE and reused across all requests)
    logger.info(f"Warming up Vectara HHEM model '{settings.HHEM_MODEL_NAME}'...")
    try:
        hhem_evaluator = VectaraHallucinationEvaluator(
            model_name=settings.HHEM_MODEL_NAME,
            device=settings.DEVICE
        )
        # Load weights in background thread so async loop isn't blocked
        await asyncio.to_thread(hhem_evaluator.load_model)
        
        # Build evaluation registry with pre-warmed model
        eval_registry = EvaluationRegistry(hallucination_evaluator=hhem_evaluator)
        app.state.eval_engine = eval_registry
        logger.info("Modular Evaluation Engine initialized and ready.")
    except Exception as e:
        logger.error(f"Failed to load HHEM model during startup: {str(e)}", exc_info=True)
        # Still instantiate registry without pre-loaded model so server can boot
        app.state.eval_engine = EvaluationRegistry()

    yield

    # Teardown logic
    logger.info("Shutting down VeriFA AI backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="LLM and Chatbot Evaluation Platform - Testing harness for hallucinations, safety, and performance.",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.router import api_router

# Mount API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
async def health_check(request: Request) -> Dict[str, Any]:
    """Health check endpoint displaying engine readiness and available evaluators."""
    eval_engine: EvaluationRegistry = getattr(request.app.state, "eval_engine", None)
    is_ready = eval_engine is not None
    metrics_list = eval_engine.list_metrics() if eval_engine else []

    hhem_evaluator = eval_engine.get("hallucination") if eval_engine else None
    hhem_loaded = getattr(hhem_evaluator, "is_loaded", False) if hhem_evaluator else False

    return {
        "status": "healthy" if is_ready else "starting",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "eval_engine_ready": is_ready,
        "hhem_model_loaded": hhem_loaded,
        "available_metrics": metrics_list
    }


@app.get("/", tags=["System"])
async def root() -> Dict[str, str]:
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API. Visit /docs for OpenAPI documentation."
    }
