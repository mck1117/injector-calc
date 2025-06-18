import React, { useCallback, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import regression from 'regression';

import './App.css';

type InjectorTestRow = {
  injections?: number;
  pulseWidth?: number;
  totalMass?: number;
};

type InjectorTestRowCleaned = {
  injections: number;
  pulseWidth: number;
  totalMass: number;
};

const App: React.FC = () => {
  const [rows, setRows] = useState<InjectorTestRow[]>([{ }]);

  const handleInputChange = useCallback((index: number, field: keyof InjectorTestRow, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = parseFloat(value);
    setRows(newRows);
  }, [rows]);

  const removeRow = useCallback((index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  }, [rows]);

  const addRow = () => {
    setRows([...rows, { }]);
  };

  const validRows = useMemo((): InjectorTestRowCleaned[] => {
    return rows.filter(row => 
      row.injections && row.pulseWidth && row.totalMass &&
      !isNaN(row.injections) && !isNaN(row.pulseWidth) && !isNaN(row.totalMass)
    )
    .map(r => ({injections: r.injections!, pulseWidth: r.pulseWidth!, totalMass: r.totalMass!} as InjectorTestRowCleaned));
  }, [rows]);

  const dataForPlot = validRows.map(row => {
    const massPerPulse = row.totalMass / row.injections;
    return { pulseWidth: row.pulseWidth, massPerPulse: 1e3 * massPerPulse };
  });

  const avgFlowData = validRows.map(row => {
    const totalOpenTime = row.injections * row.pulseWidth;
    return { pulseWidth: row.pulseWidth, avgFlow: 1e3 * row.totalMass / totalOpenTime };
  })

  const regressionResult = regression.linear(
    dataForPlot.map(d => [d.pulseWidth, d.massPerPulse])
  );

  const regressionData = dataForPlot.map(d => ({
    pulseWidth: d.pulseWidth,
    massPerPulse: regressionResult.predict(d.pulseWidth)[1],
  }));

  const tableRows = useMemo(() => rows.map((row, index) => {
    const actualMassMg = 1e3 * row.totalMass! / row.injections!;
    const modelMass = regressionResult.predict(row.pulseWidth!)[1];
    const pctError = 100 * (modelMass - actualMassMg) / actualMassMg;

    return <div key={index} className="grid grid-cols-7 gap-2 items-center mb-1 text-sm">
            <input
              type="number"
              value={row.injections}
              onChange={e => handleInputChange(index, 'injections', e.target.value)}
              className="px-1 py-0.5 border rounded"
            />
            <input
              type="number"
              value={row.pulseWidth}
              onChange={e => handleInputChange(index, 'pulseWidth', e.target.value)}
              className="px-1 py-0.5 border rounded"
            />
            <input
              type="number"
              value={row.totalMass}
              onChange={e => handleInputChange(index, 'totalMass', e.target.value)}
              className="px-1 py-0.5 border rounded"
            />
            <div>{actualMassMg.toFixed(1)}</div>
            <div>{modelMass.toFixed(1)}</div>
            <div>{pctError.toFixed(1)}</div>
            <button onClick={() => removeRow(index)} className="text-red-500 text-lg">&times;</button>
          </div>;
  }), [rows, handleInputChange, regressionResult, removeRow]);

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
          width={600}
          height={300}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="pulseWidth" label={{ value: 'pulse width (ms)', position: 'insideBottomRight', offset: -5 }} domain={['auto', 'auto']} />
          <YAxis type="number" yAxisId="left" label={{ value: 'mass per pulse (mg)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']} />
          <YAxis type="number" yAxisId="right" orientation='right' label={{ value: 'avg flow (g/s)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']} />

          <Legend />
          <Line yAxisId="left" dataKey="massPerPulse" data={dataForPlot} stroke="#008888" name="Measured" />
          <Line yAxisId="right" dataKey="avgFlow" data={avgFlowData} stroke="#aa0000" name="Avg Flow" />
          {/* <Line yAxisId="left" name="Regression" type="linear" dataKey="massPerPulse" data={regressionData} stroke="#82ca9d" dot={false} /> */}
        </LineChart>
        <div className="mt-4">
          <p><strong>Flow Rate (slope):</strong> {regressionResult.equation[0].toFixed(2)} g/s</p>
          <p><strong>Deadtime (x-intercept):</strong> {(-regressionResult.equation[1] / regressionResult.equation[0]).toFixed(2)} ms</p>
        </div>
      </div>
    </div>
  );
};

export default App;
