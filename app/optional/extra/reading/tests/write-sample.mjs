// Writes the sample library as a .traum file to standard output (the sample handed out with each
// stage): node app/optional/extra/reading/tests/write-sample.mjs > reading-sample.traum

import * as lib from '../../../../core/world/lib.js';
import { sampleWorld } from './sample.js';

const { w, room } = sampleWorld(lib);
process.stdout.write(lib.traum.write(lib.model.tablesOf(w, room), { root: room }));
