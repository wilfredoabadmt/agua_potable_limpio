import { test, expect } from '@playwright/test';

test('flujo completo: login -> lectura -> cobro -> recibo', async ({ page }) => {
  // Login como administrador
  await page.goto('/login');
  await page.fill('input[name="correo"]', 'admin@agua.bo');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');

  // Navegar a lecturas
  await page.goto('/lecturas');
  // Buscar un socio (Socio 1)
  await page.fill('input[placeholder*="socio"]', 'Socio 1');
  // Seleccionar el primer medidor
  await page.click('button:has-text("Registrar")');
  
  // Ingresar lectura (asumimos que la anterior es 0 o similar del seed)
  const lecturaInput = page.locator('input[name="lectura"]');
  await lecturaInput.fill('10');
  await page.click('button:has-text("Guardar")');
  
  // Validar que se guardó (toast o redirección/cambio de estado)
  // Nota: Dependiendo de la implementación exacta, esto puede variar.
  // Vamos a socios para cobrar
  await page.goto('/socios');
  await page.fill('input[placeholder*="socio"]', 'Socio 1');
  await page.click('text=Socio 1'); // Entrar al detalle del socio
  
  // Seleccionar cargos pendientes para cobrar
  await page.click('button:has-text("Cobrar")');
  await page.selectOption('select[name="metodo"]', 'EFECTIVO');
  await page.click('button:has-text("Confirmar Pago")');
  
  // Validar recibo
  await expect(page).toHaveURL(/\/imprimir\/recibo\/\d+/);
  await expect(page.locator('text=Comprobante de Pago')).toBeVisible();
});
