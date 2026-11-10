import { describe, it, expect, vi } from 'vitest';
import { crearPago } from './pagos';

// Mock de db.tx y PoolClient
vi.mock('./db', () => ({
  tx: vi.fn((cb) => cb({
    query: vi.fn()
  }))
}));

describe('Pagos - FIFO', () => {
  it('debe lanzar error si no se seleccionan cargos', async () => {
    const cx = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] })
    };
    await expect(crearPago({ socioId: 1, cargoIds: [], metodo: 'EFECTIVO', cajeroId: 1 }, cx as any))
      .rejects.toThrow('Seleccione al menos un medidor');
  });

  it('debe lanzar error si se salta cargos pendientes (FIFO)', async () => {
    const cx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1, periodo: '2024-01', medidor_id: 1 }, { id: 2, periodo: '2024-02', medidor_id: 1 }, { id: 3, periodo: '2024-03', medidor_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ t: 30 }] })
        .mockResolvedValueOnce({ rows: [{ id: 100 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
    };
    // Selecciona cargo 1 y 3, saltando cargo 2 (periodo 2024-02)
    await expect(crearPago({ socioId: 1, cargoIds: [1, 3], metodo: 'EFECTIVO', cajeroId: 1 }, cx as any))
      .rejects.toThrow('Debe pagar todos los cargos del periodo más antiguo antes de avanzar');
  });

  it('debe permitir pagar si se seleccionan cargos consecutivos desde el inicio', async () => {
    const cx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 1, periodo: '2024-01', medidor_id: 1 }, { id: 2, periodo: '2024-02', medidor_id: 1 }] }) // pend
        .mockResolvedValueOnce({ rows: [{ t: 30 }] }) // tot
        .mockResolvedValueOnce({ rows: [{ id: 100 }] }) // insert pago
        .mockResolvedValueOnce({ rows: [] }) // update cargos
        .mockResolvedValueOnce({ rows: [] }) // insert auditoria
    };
    const pagoId = await crearPago({ socioId: 1, cargoIds: [1, 2], metodo: 'EFECTIVO', cajeroId: 1 }, cx as any);
    expect(pagoId).toBe(100);
    expect(cx.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE cargos'), expect.anything());
  });
});
