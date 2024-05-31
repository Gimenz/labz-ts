import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import WAClient from "./handlers/client";
import logger from "./utils/logger";

try {
    const dbPath = join(__dirname, '..', 'db')
    if (!existsSync(dbPath)) {
        mkdirSync(dbPath)
    }
    new WAClient().start()
} catch (error) {
    logger.error(error)
}