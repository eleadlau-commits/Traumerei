// Joyce and Pessoa for the core's tests: corpus plugins since open core step 1a, bound to the
// world's rules through the plugin API's parts (surface(lib)), as the app binds them. Not shipped.

import * as lib from '../lib.js';
import { surface } from '../../api/v2.js';
import { bind as bindJoyce } from '../../joyce/world.js';
import { bind as bindPessoa } from '../../pessoa/world.js';
import joyceRule from '../../joyce/rules.js';
import pessoaRule from '../../pessoa/rules.js';

const parts = surface(lib);
bindJoyce(parts);
bindPessoa(parts);

export const joyce = joyceRule;
export const pessoa = pessoaRule;
export const ROOM_TYPES = [joyceRule, pessoaRule];
export * as J from '../../joyce/rules.js';
