import { Collection } from "@discordjs/collection";
import type { ICommand, IEvent } from "../types";

export const events = new Collection<string, IEvent>()
export const commands = new Collection<string, ICommand>()