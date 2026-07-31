#!/usr/bin/env node
import { CLIHandler } from './cli/CLIHandler';

const cli = new CLIHandler();
cli.parse(process.argv);
