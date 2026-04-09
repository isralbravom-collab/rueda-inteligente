import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Registrar from './pages/Registrar'
import Plan from './pages/Plan'
import Historial from './pages/Historial'
import Graficas from './pages/Graficas'
import Suplementos from './pages/Suplementos'
import Perfil from './pages/Perfil'
import Strava from './pages/Strava'
import { useStore } from './hooks/useStore'

export default function App() {
  const store = useStore()

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard rides={store.rides} profile={store.profile}/>}/>
          <Route path="/registrar" element={
            <Registrar
              rides={store.rides}
              supps={store.supps}
              profile={store.profile}
              addRide={store.addRide}
              isDuplicate={store.isDuplicate}
            />
          }/>
          <Route path="/plan" element={<Plan rides={store.rides} supps={store.supps} profile={store.profile}/>}/>
          <Route path="/historial" element={<Historial rides={store.rides} deleteRide={store.deleteRide}/>}/>
          <Route path="/graficas" element={<Graficas rides={store.rides}/>}/>
          <Route path="/suplementos" element={<Suplementos supps={store.supps} addSupp={store.addSupp} deleteSupp={store.deleteSupp} profile={store.profile} rides={store.rides}/>}/>
          <Route path="/perfil" element={<Perfil profile={store.profile} saveProfile={store.saveProfile}/>}/>
          <Route path="/strava" element={<Strava rides={store.rides} addRide={store.addRide} isDuplicate={store.isDuplicate} profile={store.profile}/>}/>
        </Routes>
      </main>
    </div>
  )
}
