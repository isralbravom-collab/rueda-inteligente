import React from 'react'

export default function IABox({ text, label = 'Análisis IA', loading = false }) {
  if (!text && !loading) return null
  return (
    <div className="iab">
      <div className="iah">
        <div className="iad" />
        <span className="iat">{label}</span>
      </div>
      <div className="iatx">
        {loading ? <span><span className="spin" style={{marginRight:8}}/> Analizando...</span> : text}
      </div>
    </div>
  )
}
