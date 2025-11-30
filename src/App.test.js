import { render, screen } from '@testing-library/react';
import React from 'react';
import LandingPage from './pages/LandingPage';

jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: ({ element }) => element,
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/' })
  };
}, { virtual: true });

// Smoke test to ensure the landing page renders expected copy
it('shows the landing page call to action', () => {
  render(<LandingPage />);

  expect(screen.getByText(/Future Toronto Transit Mapper/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /try it now/i })).toBeInTheDocument();
});
