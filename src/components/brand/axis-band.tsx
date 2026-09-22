/** Huincha tricolor corporativa: gris 58% · azul 30% · naranjo 12%. */
export function AxisBand({ height = 6 }: { height?: number }) {
  return (
    <div aria-hidden className="flex w-full" style={{ height }}>
      <span className="bg-brand-gray" style={{ width: "58%" }} />
      <span className="bg-accent" style={{ width: "30%" }} />
      <span className="bg-brand-orange" style={{ width: "12%" }} />
    </div>
  );
}
