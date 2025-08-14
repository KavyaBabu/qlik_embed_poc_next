import sys
import uuid

from core.database import get_database_connection
from loguru import logger
from pydantic_settings import BaseSettings
from repositories.work_order import WorkOrderRepository


class Settings(BaseSettings):
    DB_SECRET_ARN: str = ""
    DB_PROXY_ENDPOINT: str = ""
    DB_NAME: str = ""
    LOG_LEVEL: str = "INFO"


settings = Settings()

logger.remove()
logger.add(sys.stderr, level=settings.LOG_LEVEL.upper())


def is_valid_uuid(val: str) -> bool:
    """
    Validate whether a string is a valid UUID format.
    """
    try:
        uuid.UUID(val)
        return True
    except (ValueError, TypeError):
        return False


def update_work_order_status(work_order_id: str, new_status: str):
    """
    Updates the status of a work order in the DB.
    Ensures the work order exists before updating.
    """
    if not work_order_id or not is_valid_uuid(work_order_id):
        logger.warning(f"Invalid or missing work_order_id: '{work_order_id}' — skipping status update.")
        return

    conn = None
    try:
        conn = get_database_connection(
            proxy_endpoint=settings.DB_PROXY_ENDPOINT,
            db_name=settings.DB_NAME,
            secret_arn=settings.DB_SECRET_ARN,
        )

        repo = WorkOrderRepository(conn)

        existing = repo.get_by_id(work_order_id)
        if not existing:
            logger.warning(f"Work order {work_order_id} does not exist. Skipping status update.")
            return

        repo.update_status(work_order_id, new_status)
        logger.info(f"Successfully updated status of work order {work_order_id} to {new_status}")

    except Exception:
        logger.exception(f"Failed to update status for work order {work_order_id}")

    finally:
        if conn:
            try:
                conn.close()
                logger.info("Database connection closed successfully.")
            except Exception:
                logger.warning("Failed to close database connection.")
