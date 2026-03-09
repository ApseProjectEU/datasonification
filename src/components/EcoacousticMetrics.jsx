import './EcoacousticMetrics.css';

export default function EcoacousticMetrics({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="eco-metrics">
      <h3>Ecoacoustic Analysis</h3>

      <div className="metrics-grid">
        <div className="metric-card accent-purple">
          <div className="metric-label">ACI</div>
          <div className="metric-value">{metrics.aci}</div>
          <div className="metric-desc">Acoustic Complexity Index</div>
          <div className="metric-badge">{metrics.complexity}</div>
        </div>

        <div className="metric-card accent-blue">
          <div className="metric-label">ADI</div>
          <div className="metric-value">{metrics.adi}</div>
          <div className="metric-desc">Acoustic Diversity Index</div>
          <div className="metric-badge">{metrics.diversity}</div>
        </div>
      </div>

      <h4>Soundscape Composition</h4>
      <div className="composition-bars">
        <div className="comp-row">
          <span className="comp-label">Geophony</span>
          <div className="comp-bar-track">
            <div className="comp-bar geo" style={{ width: `${metrics.geophony}%` }} />
          </div>
          <span className="comp-value">{metrics.geophony}%</span>
        </div>
        <div className="comp-row">
          <span className="comp-label">Biophony</span>
          <div className="comp-bar-track">
            <div className="comp-bar bio" style={{ width: `${metrics.biophony}%` }} />
          </div>
          <span className="comp-value">{metrics.biophony}%</span>
        </div>
        <div className="comp-row">
          <span className="comp-label">Anthropophony</span>
          <div className="comp-bar-track">
            <div className="comp-bar anthro" style={{ width: `${metrics.anthropophony}%` }} />
          </div>
          <span className="comp-value">{metrics.anthropophony}%</span>
        </div>
      </div>

      <div className="eco-info">
        <p><strong>Geophony:</strong> Natural non-biological sounds (wind, water, thunder)</p>
        <p><strong>Biophony:</strong> Sounds produced by living organisms (birds, insects)</p>
        <p><strong>Anthropophony:</strong> Human-generated sounds (traffic, machinery)</p>
      </div>
    </div>
  );
}
