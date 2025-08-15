import sys
import uuid
from loguru import logger
from pydantic_settings import BaseSettings
from core.database import get_database_connection
from repositories.work_order import WorkOrderRepository


class Settings(BaseSettings):
    DB_SECRET_ARN: str = ""
    DB_PROXY_ENDPOINT: str = ""
    DB_NAME: str = ""
    LOG_LEVEL: str = "INFO"


settings = Settings()
logger.remove()
logger.add(sys.stderr, level=settings.LOG_LEVEL.upper())


class WorkOrderError(Exception):
    """Base exception for work order status update errors."""


class InvalidWorkOrderIDError(WorkOrderError):
    """Raised when the work_order_id is missing or invalid."""


class WorkOrderNotFoundError(WorkOrderError):
    """Raised when the specified work order is not found in the database."""


class DatabaseOperationError(WorkOrderError):
    """Raised when there is a database error."""


def is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(val)
        return True
    except (ValueError, TypeError):
        return False


def update_work_order_status(work_order_id: str, new_status: str) -> None:
    if not is_valid_uuid(work_order_id):
        raise InvalidWorkOrderIDError(f"Invalid or missing work_order_id: '{work_order_id}'")

    conn = None
    try:
        conn = get_database_connection(
            proxy_endpoint=settings.DB_PROXY_ENDPOINT,
            db_name=settings.DB_NAME,
            secret_arn=settings.DB_SECRET_ARN,
        )
        repo = WorkOrderRepository(conn)

        if not repo.get_by_id(work_order_id):
            raise WorkOrderNotFoundError(f"Work order {work_order_id} does not exist.")

        repo.update_status(work_order_id, new_status)
        logger.info(f"Status of work order {work_order_id} updated to {new_status}")

    except WorkOrderError:
        raise 
    except Exception as e:
        logger.exception(f"Database operation failed for work order {work_order_id}")
        raise DatabaseOperationError(str(e)) from e
    finally:
        if conn:
            try:
                conn.close()
                logger.debug("Database connection closed.")
            except Exception:
                logger.warning("Failed to close database connection.")
