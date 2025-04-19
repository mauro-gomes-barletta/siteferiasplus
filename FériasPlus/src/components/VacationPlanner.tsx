import React, { useState } from 'react';

const VacationPlanner: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [budget, setBudget] = useState('');
    const [preferences, setPreferences] = useState('');

    const handlePlanVacation = () => {
        // Logic to optimize vacation planning based on input
        console.log('Planning vacation with:', { startDate, endDate, budget, preferences });
    };

    return (
        <div>
            <h1>Vacation Planner</h1>
            <form onSubmit={(e) => { e.preventDefault(); handlePlanVacation(); }}>
                <div>
                    <label>Start Date:</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div>
                    <label>End Date:</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
                <div>
                    <label>Budget:</label>
                    <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} required />
                </div>
                <div>
                    <label>Preferences:</label>
                    <textarea value={preferences} onChange={(e) => setPreferences(e.target.value)} />
                </div>
                <button type="submit">Plan Vacation</button>
            </form>
        </div>
    );
};

export default VacationPlanner;