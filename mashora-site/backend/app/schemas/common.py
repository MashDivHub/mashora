from pydantic import BaseModel, ConfigDict, Field


class Message(BaseModel):
    message: str


class HealthCheck(BaseModel):
    status: str
    database: str
    redis: str
    version: str
