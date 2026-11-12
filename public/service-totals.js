// La atención finalizada suma trabajo realizado; el pago confirma dinero recibido.
export function serviceTotals(appointments) {
  const unique = [...new Map(appointments.map((a) => [a.id, a])).values()];
  const finished = unique.filter((a) => a.status === 'Finalizada');
  return {
    count: finished.length,
    total: finished.reduce((sum, a) => sum + Number(a.price), 0),
    pending: finished.reduce(
      (sum, a) => sum + (a.payment_status === 'Pagado' ? 0 : Number(a.price)),
      0,
    ),
  };
}
