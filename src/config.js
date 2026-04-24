'use strict';

function loadConfig() {
  const pairs = [];
  let n = 1;

  // PAIR_n_INPUT / PAIR_n_OUTPUT in .env are HOST paths used only by docker-compose for
  // volume mounts. Inside the container the vault is always at /inputs/N and /outputs/N.
  while (process.env[`PAIR_${n}_NAME`]) {
    const name = process.env[`PAIR_${n}_NAME`];
    const port = parseInt(process.env[`PAIR_${n}_PORT`] || '8080', 10);
    const input = `/inputs/${n}`;
    const output = `/outputs/${n}`;

    pairs.push({ name, input, output, port, index: n });
    n++;
  }

  if (pairs.length === 0) {
    console.error('No vault pairs configured. Set PAIR_1_NAME and PAIR_1_PORT in the environment (PAIR_1_INPUT/OUTPUT are for docker-compose volumes only).');
    process.exit(1);
  }

  // Comma-separated folder names to exclude from watching and syncing.
  // Example: IGNORE_FOLDERS=.obsidian,.trash,templates,_private
  const ignoreFolders = (process.env.IGNORE_FOLDERS || '.obsidian,.trash')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return { pairs, ignoreFolders };
}

module.exports = { loadConfig };
