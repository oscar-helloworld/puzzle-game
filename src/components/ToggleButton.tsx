import React from "react";
export default function ToggleButton({ pressed, onToggle, children, title }:{pressed:boolean;onToggle:()=>void;children:React.ReactNode;title?:string}){
  return <button aria-pressed={pressed} onClick={onToggle} title={title}>{children} {pressed?"开":"关"}</button>;
}
