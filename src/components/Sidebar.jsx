import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to:'/', label:'Dashboard', icon:<path strokeLinecap="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/> },
  { to:'/registrar', label:'Registrar rodada', icon:<><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></> },
  { to:'/plan', label:'Plan semanal', icon:<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></> },
]
const links2 = [
  { to:'/historial', label:'Historial', icon:<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/> },
  { to:'/graficas', label:'Gráficas', icon:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
  { to:'/suplementos', label:'Suplementación', icon:<><path d="M9 3h6l1 9H8z"/><rect x="7" y="12" width="10" height="9" rx="1"/></> },
]
const links3 = [
  { to:'/perfil', label:'Mi perfil', icon:<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></> },
  { to:'/strava', label:'Strava sync', icon:<><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></> },
]

function NavItem({ to, label, icon, onClick }) {
  return (
    <NavLink to={to} className={({isActive}) => 'ni'+(isActive?' active':'')} onClick={onClick}>
      <svg viewBox="0 0 24 24">{icon}</svg>
      {label}
    </NavLink>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <>
      <button className="mb-btn" onClick={() => setOpen(o=>!o)}>
        <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <aside className={`sidebar${open?' open':''}`}>
        <div className="logo">
          <div className="wm">Rueda <em>Inteligente</em></div>
          <div className="tg">Entrenamiento con IA</div>
        </div>
        <div className="ns">Principal</div>
        {links.map(l => <NavItem key={l.to} {...l} onClick={close}/>)}
        <div className="ns">Seguimiento</div>
        {links2.map(l => <NavItem key={l.to} {...l} onClick={close}/>)}
        <div className="ns">Cuenta</div>
        {links3.map(l => <NavItem key={l.to} {...l} onClick={close}/>)}
        <div className="sb-foot">Datos guardados localmente en tu dispositivo.</div>
      </aside>
    </>
  )
}
