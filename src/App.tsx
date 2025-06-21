import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import regression from 'regression';

import './App.css';

type InjectorTestRow = {
  injections?: number;
  pulseWidth?: number;
  totalMass?: number;
  id: string;
};

let nextId = 0;
const makeRow = (): InjectorTestRow => ({ id: 'rowInput-' + nextId++ });

type InjectorTestRowCleaned = {
  injections: number;
  pulseWidth: number;
  totalMass: number;
};

const rowIsValid = (row: InjectorTestRow) =>
  row.injections && row.pulseWidth && row.totalMass &&
      !isNaN(row.injections) && !isNaN(row.pulseWidth) && !isNaN(row.totalMass);

const formatRowValue = (val: number) => {
  if (val === undefined || isNaN(val)) {
    return '';
  }

  return val.toFixed(1);
}

const App: React.FC = () => {
  const [rows, setRows] = useState<InjectorTestRow[]>([makeRow()]);

  const handleInputChange = useCallback((index: number, mutateRow: (row: InjectorTestRow, value: number) => void, value: string) => {
    const newRows = [...rows];
    mutateRow(newRows[index], parseFloat(value));
    setRows(newRows);
  }, [rows]);

  const removeRow = useCallback((index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  }, [rows]);

  const addRow = useCallback(() => {
    setRows([...rows, makeRow()]);
  }, [rows]);

  useEffect(() => {
    document.getElementById(rows[rows.length - 1].id)?.focus();
  }, [rows.length]);

  const validRows = useMemo((): InjectorTestRowCleaned[] => {
    return rows.filter(rowIsValid)
    .map(r => ({injections: r.injections!, pulseWidth: r.pulseWidth!, totalMass: r.totalMass!} as InjectorTestRowCleaned));
  }, [rows]);

  const regressionResult = regression.linear(
    validRows.map(d => [d.pulseWidth, 1e3 * d.totalMass / d.injections])
  );

  const dataForPlot = validRows.map(row => {
    const massPerPulse = row.totalMass / row.injections;

    const actualMassMg = 1e3 * row.totalMass / row.injections;
    const modelMass = regressionResult.predict(row.pulseWidth)[1];
    const pctError = 100 * (modelMass - actualMassMg) / actualMassMg;

    return {
      pulseWidth: row.pulseWidth,
      massPerPulse: 1e3 * massPerPulse,
      err: pctError,
      modelMass,
    };
  });

  const tableRows = useMemo(() => rows.map((row, index) => {
    const actualMassMg = 1e3 * row.totalMass! / row.injections!;
    const modelMass = regressionResult.predict(row.pulseWidth!)[1];
    const pctError = 100 * (modelMass - actualMassMg) / actualMassMg;

    const isLastRow = index === rows.length - 1;

    return <div key={index} className="grid grid-cols-7 gap-2 items-center mb-1 text-sm">
            <input
              id={row.id}
              type="number"
              value={row.injections}
              onChange={e => handleInputChange(index, (r, v) => r.injections = v, e.target.value)}
              className="px-1 py-0.5 border rounded"
            />
            <input
              type="number"
              value={row.pulseWidth}
              onChange={e => handleInputChange(index, (r, v) => r.pulseWidth = v, e.target.value)}
              className="px-1 py-0.5 border rounded"
            />
            <input
              type="number"
              value={row.totalMass}
              onChange={e => handleInputChange(index, (r, v) => r.totalMass = v, e.target.value)}
              className="px-1 py-0.5 border rounded"
              onBlur={() => {
                if (isLastRow && rowIsValid(row)) {
                  addRow();
                }
              }}
            />
            <div>{formatRowValue(actualMassMg)}</div>
            <div>{formatRowValue(modelMass)}</div>
            <div>{formatRowValue(pctError)}</div>
            { !isLastRow && <button onClick={() => removeRow(index)} className="text-red-500 text-lg">&times;</button>}
          </div>;
  }), [rows, handleInputChange, regressionResult, addRow, removeRow]);

  return (
    <div className="p-4 grid gap-4">
      <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '0.5rem' }}>
        <h2 className="text-xl font-bold mb-2">Injector Calculator</h2>
        <div className="grid grid-cols-7 gap-2 font-bold mb-2">
          <div>Injections</div>
          <div>Pulse Width (ms)</div>
          <div>Total Mass (g)</div>
          <div>Mass Per (mg)</div>
          <div>Est Mass Per (mg)</div>
          <div>Model Err (%)</div>
          <div></div>
        </div>
        {tableRows}
        <button onClick={addRow} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Add Row</button>

        <p/>

        <LineChart
          width={800}
          height={600}
          margin={{ top: 5 }}
          data={dataForPlot}
        >
          <CartesianGrid strokeDasharray="5 8" />
          <XAxis type="number" dataKey="pulseWidth" label={{ value: 'pulse width (ms)', position: 'insideBottomRight', offset: -5 }} domain={['auto', 'auto']} />
          <YAxis type="number" yAxisId="left" label={{ value: 'mass per pulse (mg)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']} />
          <YAxis type="number" yAxisId="right" orientation='right' label={{ value: 'model err (%)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']} />

          <Legend />
          <Line yAxisId="left" dataKey="massPerPulse" stroke="#008888" name="Measured" />
          <Line yAxisId="right" dataKey="err" stroke="#aa0000" name="Model Err" />
          <Line yAxisId="left" dataKey="modelMass" stroke="#82ca9d" name="model" type="linear" dot={false} />
        </LineChart>
        <div className="mt-4">
          <p><strong>Flow Rate:</strong> {regressionResult.equation[0].toFixed(2)} g/s = {(83.333 * regressionResult.equation[0]).toFixed(1)} cc/min</p>
          <p><strong>Deadtime:</strong> {(-regressionResult.equation[1] / regressionResult.equation[0]).toFixed(2)} ms</p>
        </div>
      </div>
    </div>
  );
};

export default App;
