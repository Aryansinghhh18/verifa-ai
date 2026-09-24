from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.chatbots import router as chatbots_router
from app.api.v1.evaluations import router as evaluations_router
from app.api.v1.batch import router as batch_router
from app.api.v1.analytics import router as analytics_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(chatbots_router, prefix="/chatbots", tags=["Chatbots"])
api_router.include_router(evaluations_router, prefix="/evaluations", tags=["Evaluations"])
api_router.include_router(batch_router, prefix="/batch", tags=["Batch Evaluation"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
