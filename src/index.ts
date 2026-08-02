#!/usr/bin/env node
import { CLIHandler } from './cli/CLIHandler';

if (require.main === module || process.argv[1]?.includes('index.js') || process.argv[1]?.includes('flowdownloader')) {
  const cli = new CLIHandler();
  cli.parse(process.argv);
}
