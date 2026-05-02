"""
Project D.R.O.P. — Drought Recognition & Optimization Platform
===============================================================
A proactive, AI-driven irrigation system dashboard built with Streamlit.
Designed for engineering exhibition display.

Dependencies: streamlit, pandas, plotly
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import math

# ─────────────────────────────────────────────
# PAGE CONFIGURATION
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="Project D.R.O.P.",
    page_icon="💧",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────
# CUSTOM CSS — clean, dark-accented modern look
# ─────────────────────────────────────────────
st.markdown(
    """
    <style>
        /* ── Global font & background ── */
        html, body, [class*="css"] {
            font-family: 'Segoe UI', sans-serif;
        }

        /* ── Top banner / hero ── */
        .hero-banner {
            background: linear-gradient(135deg, #0d3b66 0%, #1a6ea8 60%, #00b4d8 100%);
            border-radius: 16px;
            padding: 28px 36px;
            margin-bottom: 24px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.35);
        }
        .hero-banner h1 {
            color: #ffffff;
            font-size: 2.4rem;
            font-weight: 800;
            letter-spacing: 1px;
            margin: 0 0 6px 0;
        }
        .hero-banner p {
            color: #cde9f9;
            font-size: 1.02rem;
            line-height: 1.65;
            margin: 0;
        }
        .hero-badge {
            display: inline-block;
            background: rgba(255,255,255,0.18);
            border: 1px solid rgba(255,255,255,0.35);
            border-radius: 20px;
            padding: 3px 14px;
            font-size: 0.78rem;
            color: #e0f4ff;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-bottom: 10px;
        }

        /* ── Metric card ── */
        .metric-card {
            background: linear-gradient(135deg, #0d3b66, #1a6ea8);
            border-radius: 14px;
            padding: 28px 20px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            border: 1px solid rgba(30, 144, 255, 0.27);
        }
        .metric-card .label {
            color: #90caf9;
            font-size: 0.85rem;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .metric-card .value {
            font-size: 5rem;
            font-weight: 900;
            line-height: 1;
            margin: 0;
        }
        .metric-card .unit {
            color: #90caf9;
            font-size: 1rem;
            margin-top: 4px;
        }
        .metric-card .sublabel {
            color: #b0d4f1;
            font-size: 0.78rem;
            margin-top: 10px;
            font-style: italic;
        }

        /* ── Status alert boxes ── */
        .alert-danger {
            background: #3d0000;
            border-left: 6px solid #ff1744;
            border-radius: 10px;
            padding: 18px 22px;
            color: #ff8a80;
            font-size: 1.08rem;
            font-weight: 700;
            letter-spacing: 0.5px;
            animation: flashborder 1.2s infinite;
            box-shadow: 0 0 18px rgba(255,23,68,0.35);
        }
        .alert-success {
            background: #003300;
            border-left: 6px solid #00e676;
            border-radius: 10px;
            padding: 18px 22px;
            color: #69f0ae;
            font-size: 1.05rem;
            font-weight: 600;
            box-shadow: 0 0 14px rgba(0,230,118,0.2);
        }
        @keyframes flashborder {
            0%,100% { border-left-color: #ff1744; box-shadow: 0 0 18px rgba(255,23,68,0.35); }
            50%      { border-left-color: #ff6d00; box-shadow: 0 0 28px rgba(255,109,0,0.55); }
        }

        /* ── Sidebar styling ── */
        section[data-testid="stSidebar"] {
            background: #0a2540;
        }
        section[data-testid="stSidebar"] * {
            color: #cde9f9 !important;
        }
        .sidebar-title {
            font-size: 1.05rem;
            font-weight: 700;
            letter-spacing: 1px;
            color: #00b4d8 !important;
            margin-bottom: 4px;
        }
        .sidebar-section {
            background: rgba(255,255,255,0.06);
            border-radius: 10px;
            padding: 14px 16px;
            margin-bottom: 14px;
        }

        /* ── Section dividers ── */
        .section-header {
            color: #90caf9;
            font-size: 0.78rem;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            font-weight: 600;
            margin: 18px 0 10px 0;
            border-bottom: 1px solid #1e3a5f;
            padding-bottom: 6px;
        }

        /* ── Input info chips ── */
        .chip-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .chip {
            background: #1a3a5c;
            border: 1px solid #1e90ff55;
            border-radius: 20px;
            padding: 5px 14px;
            font-size: 0.82rem;
            color: #90caf9;
        }
        .chip span {
            color: #ffffff;
            font-weight: 700;
        }
    </style>
    """,
    unsafe_allow_html=True,
)

# ─────────────────────────────────────────────
# MOCK ML INFERENCE ENGINE
# ─────────────────────────────────────────────
def predict_ttd(temperature: float, moisture: float) -> float:
    """
    Simulates a trained regression model's inference output.
    """
    temp_norm     = (temperature - 15) / (45 - 15)   
    moisture_norm = moisture / 100                    

    base_ttd = 72 * (moisture_norm ** 1.4) * math.exp(-2.2 * temp_norm)
    interaction_penalty = 8 * temp_norm * (1 - moisture_norm) ** 2
    raw_ttd = base_ttd - interaction_penalty

    ttd = max(0.1, min(72.0, raw_ttd))
    return round(ttd, 2)

# ─────────────────────────────────────────────
# MOISTURE DECAY CURVE GENERATOR
# ─────────────────────────────────────────────
def build_decay_curve(initial_moisture: float, temperature: float) -> pd.DataFrame:
    """
    Projects the soil moisture level over the next 24 hours.
    """
    lambda_decay = 0.015 + 0.0045 * (temperature - 15)

    hours    = list(range(0, 25))         
    moisture = [
        max(5.0, initial_moisture * math.exp(-lambda_decay * h))
        for h in hours
    ]

    return pd.DataFrame({"Hour": hours, "Moisture (%)": moisture})

# ─────────────────────────────────────────────
# MOISTURE DECAY CHART
# ─────────────────────────────────────────────
def build_chart(df: pd.DataFrame) -> go.Figure:
    """
    Builds an interactive Plotly chart for the moisture decay projection.
    """
    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=df["Hour"],
            y=df["Moisture (%)"],
            mode="lines+markers",
            name="Projected Moisture",
            line=dict(color="#00b4d8", width=3),
            marker=dict(size=5, color="#00e5ff"),
            fill="tozeroy",
            fillcolor="rgba(0, 180, 216, 0.12)",
            hovertemplate="<b>Hour %{x}</b><br>Moisture: %{y:.1f}%<extra></extra>",
        )
    )

    fig.add_hline(
        y=20,
        line_color="#ff1744",
        line_width=2,
        line_dash="dash",
        annotation_text="  ⚠ Critical Biological Stress Threshold (20%)",
        annotation_position="top left",
        annotation_font=dict(color="#ff6d6d", size=12),
    )

    fig.add_hrect(
        y0=0, y1=20,
        fillcolor="rgba(255, 23, 68, 0.07)",
        line_width=0,
        annotation_text="Danger Zone",
        annotation_position="top right",
        annotation_font=dict(color="#ff6d6d", size=10),
    )

    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(13,59,102,0.35)",
        font=dict(color="#cde9f9", family="Segoe UI"),
        title=dict(
            text="🌱  24-Hour Soil Moisture Decay Projection",
            font=dict(size=16, color="#90caf9"),
            x=0.01,
        ),
        xaxis=dict(
            title="Time (hours from now)",
            gridcolor="#1e3a5f",
            zerolinecolor="#1e3a5f",
            tickfont=dict(color="#90caf9"),
            title_font=dict(color="#90caf9"),
        ),
        yaxis=dict(
            title="Soil Moisture (%)",
            range=[0, 105],
            gridcolor="#1e3a5f",
            zerolinecolor="#1e3a5f",
            tickfont=dict(color="#90caf9"),
            title_font=dict(color="#90caf9"),
        ),
        legend=dict(
            bgcolor="rgba(13,59,102,0.6)",
            bordercolor="rgba(30, 144, 255, 0.27)",
            borderwidth=1,
            font=dict(color="#cde9f9"),
        ),
        hovermode="x unified",
        margin=dict(l=20, r=20, t=50, b=20),
        height=400,
    )

    return fig

# ═════════════════════════════════════════════
# SIDEBAR — User Input Controls
# ═════════════════════════════════════════════
with st.sidebar:
    st.markdown(
        """
        <div style='text-align:center; padding: 10px 0 18px 0;'>
            <div style='font-size:2.5rem;'>💧</div>
            <div style='color:#00b4d8; font-size:1.1rem; font-weight:800;
                        letter-spacing:2px; text-transform:uppercase;'>
                D.R.O.P.
            </div>
            <div style='color:#5ca8d4; font-size:0.7rem; letter-spacing:1px;'>
                Control Interface
            </div>
        </div>
        <hr style='border-color:#1e3a5f; margin-bottom:18px;'>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        "<div class='sidebar-title'>🌡️ Ambient Temperature</div>",
        unsafe_allow_html=True,
    )
    temperature = st.slider(
        label="Temperature (°C)",
        min_value=15,
        max_value=45,
        value=28,
        step=1,
        help="Current ambient air temperature recorded by the DHT-22 sensor array.",
    )

    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown(
        "<div class='sidebar-title'>🌱 Soil Moisture Level</div>",
        unsafe_allow_html=True,
    )
    moisture = st.slider(
        label="Moisture (%)",
        min_value=0,
        max_value=100,
        value=40,
        step=1,
        help="Volumetric water content (%) from the capacitive soil moisture sensor.",
    )

    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown(
        "<div class='sidebar-title'>📡 Sensor Status</div>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f"""
        <div class='sidebar-section'>
            <div style='margin-bottom:8px;'>
                <span style='color:#00e676;'>● </span>
                <span style='color:#cde9f9; font-size:0.85rem;'>
                    DHT-22 Temp Sensor</span>
                <span style='float:right; color:#90caf9;
                             font-size:0.85rem;'>{temperature}°C</span>
            </div>
            <div style='margin-bottom:8px;'>
                <span style='color:#00e676;'>● </span>
                <span style='color:#cde9f9; font-size:0.85rem;'>
                    Capacitive Soil Probe</span>
                <span style='float:right; color:#90caf9;
                             font-size:0.85rem;'>{moisture}%</span>
            </div>
            <div>
                <span style='color:#00e676;'>● </span>
                <span style='color:#cde9f9; font-size:0.85rem;'>
                    ESP32 Gateway</span>
                <span style='float:right; color:#00e676;
                             font-size:0.85rem;'>ONLINE</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        "<div style='color:#3a6186; font-size:0.7rem; text-align:center;"
        "margin-top:30px;'>v1.0.0 · STEM Exhibition Build<br>"
        "© 2026 Project D.R.O.P. Team</div>",
        unsafe_allow_html=True,
    )

# ═════════════════════════════════════════════
# MAIN PANEL
# ═════════════════════════════════════════════

st.markdown(
    """
    <div class='hero-banner'>
        <div class='hero-badge'>AI-Driven Irrigation · Engineering Exhibition</div>
        <h1>💧 Project D.R.O.P.</h1>
        <p>
            <b>Drought Recognition &amp; Optimization Platform</b> combines real-time
            IoT sensor telemetry with machine-learning inference to predict soil drought
            risk before it occurs—enabling precision, automated irrigation interventions
            that conserve water while protecting crop health.
            The platform's regression engine continuously estimates the
            <em>Time-to-Drought (TTD)</em>, triggering isolated pump relays only when
            and where biological stress is truly imminent.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

ttd = predict_ttd(temperature, moisture)

st.markdown(
    f"""
    <div class='chip-row'>
        <div class='chip'>🌡 Temperature: <span>{temperature}°C</span></div>
        <div class='chip'>🌱 Moisture: <span>{moisture}%</span></div>
        <div class='chip'>🤖 Model: <span>Mock Regression v1</span></div>
        <div class='chip'>📡 Data Source: <span>Live Sensor Feed</span></div>
    </div>
    """,
    unsafe_allow_html=True,
)

if ttd < 2.0:
    ttd_color  = "#ff1744"
    ttd_emoji  = "🚨"
    ttd_status = "CRITICAL"
elif ttd < 12.0:
    ttd_color  = "#ff9800"
    ttd_emoji  = "⚠️"
    ttd_status = "CAUTION"
else:
    ttd_color  = "#00e676"
    ttd_emoji  = "✅"
    ttd_status = "STABLE"

col_metric, col_kpis = st.columns([1, 1.8], gap="large")

with col_metric:
    st.markdown(
        f"""
        <div class='metric-card'>
            <div class='label'>⏱ Predicted Time-to-Drought</div>
            <div class='value' style='color:{ttd_color};'>{ttd}</div>
            <div class='unit'>hours</div>
            <div class='sublabel'>{ttd_emoji} Status: {ttd_status}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_kpis:
    st.markdown(
        "<div class='section-header'>Derived Indicators</div>",
        unsafe_allow_html=True,
    )

    evap_rate   = round(0.08 + 0.005 * (temperature - 15), 3)  
    risk_score  = round(max(0, min(100, 100 - (ttd / 72) * 100)), 1)
    water_saved = round(max(0, (moisture / 100) * 3.5), 2)     

    k1, k2 = st.columns(2)
    k3, k4 = st.columns(2)

    with k1:
        st.metric("Evapotranspiration Rate", f"{evap_rate} %/hr",
                  delta=f"{round(evap_rate - 0.08, 3):+} vs baseline",
                  delta_color="inverse")
    with k2:
        st.metric("Drought Risk Score", f"{risk_score} / 100",
                  delta="High" if risk_score > 70 else "Moderate" if risk_score > 40 else "Low",
                  delta_color="inverse" if risk_score > 70 else "normal")
    with k3:
        st.metric("Pump Relay Status",
                  "ARMED 🔴" if ttd < 2.0 else "STANDBY 🟢",
                  delta=None)
    with k4:
        st.metric("Est. Water Saved Today", f"{water_saved} L",
                  delta="+Precision Mode")

st.markdown(
    "<div class='section-header'>Moisture Decay Projection (Next 24 Hours)</div>",
    unsafe_allow_html=True,
)
decay_df = build_decay_curve(moisture, temperature)
fig      = build_chart(decay_df)
st.plotly_chart(fig, width="stretch")

st.markdown(
    "<div class='section-header'>System Actuation Status</div>",
    unsafe_allow_html=True,
)

if ttd < 2.0:
    st.markdown(
        f"""
        <div class='alert-danger'>
            🚨 &nbsp; SYSTEM ALERT — Drought Imminent (TTD = {ttd} hrs)
            &nbsp;·&nbsp; Initiating Isolated Pump Relay &nbsp;·&nbsp;
            Valve Zone 3 OPEN &nbsp;·&nbsp; Flow Rate: 2.4 L/min
        </div>
        """,
        unsafe_allow_html=True,
    )
else:
    st.markdown(
        f"""
        <div class='alert-success'>
            ✅ &nbsp; SYSTEM STABLE — No biological stress detected &nbsp;·&nbsp;
            TTD = {ttd} hrs &nbsp;·&nbsp; All pump relays STANDBY
        </div>
        """,
        unsafe_allow_html=True,
    )

st.markdown("<br><br>", unsafe_allow_html=True)
