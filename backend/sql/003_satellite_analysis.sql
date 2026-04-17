-- Create table for satellite analysis results
CREATE TABLE IF NOT EXISTS satellite_analysis (
    id SERIAL PRIMARY KEY,
    reservoir_id UUID NOT NULL REFERENCES reservoirs(id) ON DELETE CASCADE,
    capture_date DATE NOT NULL,
    water_surface_area FLOAT, -- Area in square meters (m2)
    change_percentage FLOAT, -- Percentage change compared to previous record
    alert_level VARCHAR(20) DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH'
    raw_response JSONB, -- Store raw API response for debugging
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reservoir_id, capture_date)
);

CREATE INDEX IF NOT EXISTS idx_satellite_reservoir_id ON satellite_analysis(reservoir_id);
CREATE INDEX IF NOT EXISTS idx_satellite_capture_date ON satellite_analysis(capture_date);
