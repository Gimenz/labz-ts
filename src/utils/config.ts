import * as dotenv from 'dotenv'
import fs from "fs";
import { join } from "path";
import { Config } from '../types';
dotenv.config()

const packagePath = join(__dirname, "..", "..", "package.json")
const configPath = join(__dirname, "..", "..", "config.json")

export const updateConfig = (obj: any) => {
    fs.writeFileSync(configPath, JSON.stringify(obj, null, 2))
}

export const packages = JSON.parse(fs.readFileSync(packagePath, "utf-8"))
export const config: Config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
