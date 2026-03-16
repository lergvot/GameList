# main.py

import socket
import sys

import eel

from app.api import *
from app.database import init_db
from app.image_utils import ensure_dirs
from app.logger import get_logger, LOG_SEPARATOR
from config import (
    APP_NAME,
    APP_VERSION,
    PORT_RANGE,
    PORT_START,
    WINDOW_POSITION,
    WINDOW_SIZE,
)

logger = get_logger(__name__)


def check_port(start_port: int = PORT_START, num_ports: int = PORT_RANGE) -> int:
    """Проверяет, что порт доступен и возвращает первый свободный порт (int)."""
    for port in range(start_port, start_port + num_ports):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                # Пытаемся привязаться к порту
                s.bind(("localhost", port))
                # Если успешно — порт свободен
                logger.info(f"Port {port} is available.")
                return port
            except OSError:
                # Порт занят — пробуем следующий
                logger.info(f"Port {port} is in use, trying next...")
                continue

    raise RuntimeError(
        f"No free port found in range {start_port}-{start_port + num_ports - 1}"
    )


if __name__ == "__main__":
    try:
        logger.info(LOG_SEPARATOR)
        logger.info("Launching %s v%s...", APP_NAME, APP_VERSION)
        eel.init("web")
        ensure_dirs()
        init_db()
        free_port = check_port()
        logger.info("Starting server on port %d", free_port)
        logger.info(LOG_SEPARATOR)
        eel.start(
            "index.html",
            size=WINDOW_SIZE,
            position=WINDOW_POSITION,
            port=free_port,
            disable_cache=True,
        )
    except KeyboardInterrupt:
        logger.info("Application interrupted by user")
        sys.exit(0)
    except RuntimeError as e:
        logger.error("Runtime error: %s", e)
        sys.exit(1)
    except Exception as e:
        logger.critical("Fatal error: %s", e, exc_info=True)
        sys.exit(1)
