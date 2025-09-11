import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

function ExitSurveyPage({ userId }) {
  const [trips, setTrips] = useState([]);
  const [taggedTrips, setTaggedTrips] = useState({});
  const [spAnswers, setSpAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchTrips = async () => {
    const sessionId = localStorage.getItem('session_id');
    if (!sessionId) return;

    const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('session_id', sessionId)  // 🔑 Filter by session_id
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching survey responses:", error);
    } else {
        setTrips(data);
    }
    };

    fetchTrips();
  }, [userId]);

  const handleTagChange = (tripId, tag) => {
    setTaggedTrips(prev => ({
      ...prev,
      [tripId]: tag
    }));
  };

  const handleSPChange = (question, value) => {
    setSpAnswers(prev => ({
      ...prev,
      [question]: value
    }));
  };

  const handleSubmit = async () => {
    const { error } = await supabase.from('exit_survey').insert([{
      id: uuidv4(),
      user_id: userId,
      tags: taggedTrips,
      sp_answers: spAnswers,
      trip_ids: Object.keys(taggedTrips),
      timestamp: new Date()
    }]);

    if (error) {
      console.error("Submission error:", error);
      alert("Failed to submit survey.");
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) return <div>Thanks for completing the exit survey!</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Exit Survey</h1>
      <p>Help us understand your travel behavior better by tagging your trips and answering a few questions.</p>

      {trips.map(trip => (
        <div key={trip.id} style={{ borderBottom: '1px solid #ccc', marginBottom: '1rem', paddingBottom: '1rem' }}>
          <h3>{trip.origin} → {trip.destination}</h3>
          <label>
            Trip Type:&nbsp;
            <select value={taggedTrips[trip.id] || ''} onChange={(e) => handleTagChange(trip.id, e.target.value)}>
              <option value="">Select</option>
              <option value="work">Work</option>
              <option value="school">School</option>
              <option value="shopping">Shopping</option>
              <option value="recreation">Recreation</option>
              <option value="frequent">Frequent Trip</option>
              <option value="rare">Rare Trip</option>
            </select>
          </label>
        </div>
      ))}

      <h3 style={{ marginTop: '2rem' }}>Tag Your Trips</h3>
        <p>You made the following trip entries. Please tag the purpose or nature of each trip.</p>

        {trips.length === 0 ? (
        <p>No trips found.</p>
        ) : (
        trips.map((trip) => (
            <div key={trip.id} style={{ marginBottom: '1rem' }}>
            <strong>{trip.origin} → {trip.destination}</strong>
            <div>
                <label htmlFor={`tag-${trip.id}`}>Tag this trip: </label>
                <select
                id={`tag-${trip.id}`}
                value={taggedTrips[trip.id] || ''}
                onChange={(e) =>
                    setTaggedTrips((prev) => ({
                    ...prev,
                    [trip.id]: e.target.value
                    }))
                }
                >
                <option value="">Select a tag</option>
                <option value="Work">Work</option>
                <option value="School">School</option>
                <option value="Frequent">Frequent</option>
                <option value="Shopping">Shopping</option>
                <option value="Social">Social</option>
                <option value="Other">Other</option>
                </select>
            </div>
            </div>
        ))
        )}


      <h2>Quick Questions</h2>
      <div>
        <label>
          If this service were 10 minutes faster, how likely would you be to use it? <br />
          <select value={spAnswers.faster10 || ''} onChange={e => handleSPChange('faster10', e.target.value)}>
            <option value="">Select</option>
            <option value="very_likely">Very Likely</option>
            <option value="somewhat_likely">Somewhat Likely</option>
            <option value="neutral">Neutral</option>
            <option value="somewhat_unlikely">Somewhat Unlikely</option>
            <option value="very_unlikely">Very Unlikely</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>
          If the cost was reduced by 25%, how likely would you be to switch? <br />
          <select value={spAnswers.cheaper25 || ''} onChange={e => handleSPChange('cheaper25', e.target.value)}>
            <option value="">Select</option>
            <option value="very_likely">Very Likely</option>
            <option value="somewhat_likely">Somewhat Likely</option>
            <option value="neutral">Neutral</option>
            <option value="somewhat_unlikely">Somewhat Unlikely</option>
            <option value="very_unlikely">Very Unlikely</option>
          </select>
        </label>
      </div>

      <button onClick={handleSubmit} style={{ marginTop: '2rem' }}>
        Submit Exit Survey
      </button>
    </div>
  );
}

export default ExitSurveyPage;