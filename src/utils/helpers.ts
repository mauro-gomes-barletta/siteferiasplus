export const calculateVacationDays = (startDate: Date, endDate: Date): number => {
    const timeDiff = endDate.getTime() - startDate.getTime();
    const dayDiff = timeDiff / (1000 * 3600 * 24);
    return dayDiff + 1; // Include the start date
};

export const isHoliday = (date: Date, holidays: Date[]): boolean => {
    return holidays.some(holiday => holiday.getTime() === date.getTime());
};

export const estimateBudget = (dailyBudget: number, days: number): number => {
    return dailyBudget * days;
};

export const getClimateRecommendation = (destination: string): string => {
    const climateData: { [key: string]: string } = {
        'Rio de Janeiro': 'Warm and humid, ideal for beach activities.',
        'São Paulo': 'Mild temperatures, suitable for city exploration.',
        'Salvador': 'Tropical climate, great for cultural experiences.',
    };
    return climateData[destination] || 'Climate information not available.';
};