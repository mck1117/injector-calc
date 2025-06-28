import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import regression from 'regression';

import './App.css';

type InjectorTestRow = {
  injections?: number;
  pulseWidth?: number;
  totalMass?: number;
  includeInRegression: boolean;
  id: string;
};

let nextId = 0;
const makeRow = (): InjectorTestRow => ({ id: 'rowInput-' + nextId++, includeInRegression: true });

type InjectorTestRowCleaned = {
  injections: number;
  pulseWidth: number;
  totalMass: number;
  includeInRegression: boolean;
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

  const handleInclude = useCallback((index: number, value: boolean) => {
    const newRows = [...rows];
    newRows[index].includeInRegression = value;
    setRows(newRows);
  }, [rows]);

  const removeRow = useCallback((index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  }, [rows]);

  const addRow = useCallback(() => {
    setRows([...rows, makeRow()]);
  }, [rows]);

  const validRows = useMemo((): InjectorTestRowCleaned[] => {
    return rows
      .filter(rowIsValid)
      .map(r => ({ injections: r.injections!, pulseWidth: r.pulseWidth!, totalMass: r.totalMass!, includeInRegression: r.includeInRegression } as InjectorTestRowCleaned));
  }, [rows]);

  const regressionResult = regression.linear(
    validRows
      .filter(r => r.includeInRegression)
      .map(d => [d.pulseWidth, 1e3 * d.totalMass / d.injections])
  );

  const flowRate = regressionResult.equation[0];
  const deadtime = -regressionResult.equation[1] / flowRate;

  const dataForPlot = validRows.map(row => {
    const massPerPulse = row.totalMass / row.injections;

    const actualMassMg = 1e3 * row.totalMass / row.injections;
    const modelMass = regressionResult.predict(row.pulseWidth)[1];
    const pctError = 100 * (modelMass - actualMassMg) / actualMassMg;

    // small pulse correction math
    const modelPulse = 1e3 * massPerPulse / flowRate;
    const smallPulseAdder = row.pulseWidth - deadtime - modelPulse;

    return {
      pulseWidth: row.pulseWidth,
      massPerPulse: 1e3 * massPerPulse,
      err: pctError,
      modelMass,
      modelPulse,
      smallPulseAdder
    };
  });

  const tableRows = useMemo(() => rows.map((row, index) => {
    const actualMassMg = 1e3 * row.totalMass! / row.injections!;
    const modelMass = regressionResult.predict(row.pulseWidth!)[1];
    const pctError = 100 * (modelMass - actualMassMg) / actualMassMg;

    const isLastRow = index === rows.length - 1;

    return <div key={index} className="grid grid-cols-8 gap-2 items-center mb-1 text-sm">
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
      <input type="checkbox" checked={row.includeInRegression} onChange={e => handleInclude(index, e.target.checked)} />
      <div>{formatRowValue(actualMassMg)}</div>
      <div>{formatRowValue(modelMass)}</div>
      <div>{formatRowValue(pctError)}</div>
      {isLastRow
        ? <button onClick={addRow} className="text-black-500 text-lg">Add Row</button>
        : <button onClick={() => removeRow(index)} className="text-red-500 text-lg">&times;</button>}
    </div>;
  }), [rows, handleInputChange, handleInclude, regressionResult, addRow, removeRow]);

  // Focus the last row's input when a new row is added
  useEffect(() => {
    document.getElementById(rows[rows.length - 1].id)?.focus();

    // Intentionally don't update on rows, only when the length changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  return (
    <div className="p-4 grid gap-4">
      <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '0.5rem' }}>
        <h2 className="text-xl font-bold mb-2">Injector Calculator</h2>
        <div className="grid grid-cols-8 gap-2 font-bold mb-2">
          <div>Injections</div>
          <div>Pulse Width (ms)</div>
          <div>Total Mass (g)</div>
          <div>Include in regression</div>
          <div>Mass Per (mg)</div>
          <div>Est Mass Per (mg)</div>
          <div>Model Err (%)</div>
          <div></div>
        </div>
        {tableRows}

        <p />

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
          <p><strong>Flow Rate:</strong> {flowRate.toFixed(2)} g/s = {(83.333 * flowRate).toFixed(1)} cc/min</p>
          <p><strong>Deadtime:</strong> {deadtime.toFixed(2)} ms</p>
        </div>
        <h2 className="text-xl font-bold mb-2">Small Pulse Correction Table</h2>
        <div >
          <div>{dataForPlot.map(c => c.smallPulseAdder.toFixed(3)).join(', ')}</div>
          <div>{dataForPlot.map(c => c.modelPulse.toFixed(3)).join(', ')}</div>
        </div>
      </div>
    </div>
  );
};

export default App;
