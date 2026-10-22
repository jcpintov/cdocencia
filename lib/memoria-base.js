import {readFileSync} from 'node:fs';
export const MEMORIA_BASE=JSON.parse(readFileSync(new URL('../config/memoria-agente.json',import.meta.url),'utf8'));
export const CRITERIOS_MEMORIA=MEMORIA_BASE.criterios.map(c=>c.regla);
