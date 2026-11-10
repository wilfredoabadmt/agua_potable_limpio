import { describe, it, expect } from 'vitest';
import { calcular, type Tarifa } from './tarifa';

describe('Tarifa - cálculo', () => {
  const domiciliaria: Tarifa = {
    tipo: 'CONSUMO',
    cargo_minimo: 15,
    m3_minimos: 9,
    tramos: [
      { desde: 10, hasta: 15, precio: 2 },
      { desde: 16, hasta: null, precio: 3 },
    ],
  };

  it('debe calcular tarifa domiciliaria correctamente', () => {
    // 12 m3: 15 (base) + (12 - 9) = 3 m3 en tramo 10-15. 3 * 2 = 6. Total = 21
    expect(calcular(domiciliaria, 12)).toEqual({ base: 15, exceso: 6, total: 21 });
    
    // 20 m3: 15 (base) + 6 m3 (tramo 10-15) * 2 = 12 + 5 m3 (tramo 16-20) * 3 = 15. Total = 15+12+15=42
    expect(calcular(domiciliaria, 20)).toEqual({ base: 15, exceso: 27, total: 42 });
  });

  const comercial: Tarifa = {
    tipo: 'CONSUMO',
    cargo_minimo: 25,
    m3_minimos: 12,
    tramos: [
      { desde: 13, hasta: 20, precio: 3 },
      { desde: 21, hasta: null, precio: 4.5 },
    ],
  };

  it('debe calcular tarifa comercial correctamente', () => {
    // 12 m3: 25 (base) + 0 exceso = 25
    expect(calcular(comercial, 12)).toEqual({ base: 25, exceso: 0, total: 25 });
    // 13 m3: 25 (base) + 1*3 = 28
    expect(calcular(comercial, 13)).toEqual({ base: 25, exceso: 3, total: 28 });
    // 20 m3: 25 (base) + 8*3 = 24. Total = 49
    expect(calcular(comercial, 20)).toEqual({ base: 25, exceso: 24, total: 49 });
    // 21 m3: 25 (base) + 24 (exceso tramo 1) + 1*4.5 = 28.5. Total = 53.5
    expect(calcular(comercial, 21)).toEqual({ base: 25, exceso: 28.5, total: 53.5 });
    // 30 m3: 25 (base) + 24 (tramo 1) + 10*4.5 = 45. Total = 25+24+45=94
    expect(calcular(comercial, 30)).toEqual({ base: 25, exceso: 69, total: 94 });
  });

  it('debe calcular tarifa fija correctamente', () => {
    const fija: Tarifa = { tipo: 'FIJA', cargo_minimo: 15, m3_minimos: 0, tramos: [] };
    expect(calcular(fija, 100)).toEqual({ base: 15, exceso: 0, total: 15 });
  });
});
