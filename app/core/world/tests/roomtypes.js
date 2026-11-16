// Joyce, Pessoa and Twin's hook for the core's tests: corpus plugins since open core step 1a, bound to the
// world's rules through the plugin API's parts (surface(lib)), as the app binds them. Not shipped.

import * as lib from '../lib.js';
import { surface } from '../../api/v2.js';
import { bind as bindJoyce } from '../../joyce/world.js';
import { bind as bindPessoa } from '../../pessoa/world.js';
import joyceRule from '../../joyce/rules.js';
import pessoaRule from '../../pessoa/rules.js';
import twinHolds from '../../twin/holds.js';
import { setHolds } from '../model.js';

const parts = surface(lib);
bindJoyce(parts);
bindPessoa(parts);
setHolds([twinHolds]); // a Twin may hold its two sides (the Twin plugin's hook)

export const joyce = joyceRule;
export const pessoa = pessoaRule;
export const ROOM_TYPES = [joyceRule, pessoaRule];
export * as J from '../../joyce/rules.js';
