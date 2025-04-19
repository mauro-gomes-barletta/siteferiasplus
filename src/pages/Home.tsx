import React from 'react';

const Home: React.FC = () => {
    return (
        <div>
            <h1>Welcome to FériasPlus!</h1>
            <p>Your ultimate vacation planning tool based on Brazilian labor laws, holidays, climate, and budget.</p>
            <nav>
                <ul>
                    <li><a href="/about">About</a></li>
                    <li><a href="/contact">Contact</a></li>
                    <li><a href="/planner">Plan Your Vacation</a></li>
                </ul>
            </nav>
        </div>
    );
};

export default Home;