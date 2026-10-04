import { Link } from 'react-router-dom';
import ApiStatus from '../components/ApiStatus.jsx';

const features = [
  { title: 'Raise complaints', text: 'Report hostel issues in seconds and track them end to end.' },
  { title: 'Smart escalation', text: 'Unresolved issues move up the chain automatically.' },
  { title: 'Full transparency', text: 'Students, wardens and admins share one clear timeline.' },
];

export default function LandingPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-indigo-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Smart Hostel Management
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            BBDU Hosteller
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            A smart hostel management and complaint escalation platform that keeps residents,
            wardens and administrators connected.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/login"
              className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-indigo-700"
            >
              Get started
            </Link>
          </div>
          <div className="mt-8 flex justify-center">
            <ApiStatus />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
