import { initPopupLogic, logoutUser } from '/layout/auth.js'; 
import { fetchAllSearchData } from '/Article/firebase-db.js';
import { saveToNewsletterList } from '/admin/user-db.js'; 

// =========================================================================
//  EMBEDDED CSS (Paste your layout.css content here)
// =========================================================================
const layoutCSS = `
/* Extracted Styles for Header, Sidebar, Subscribe Button, and Footer */
#global-header { position: sticky; top: 0; z-index: 1000; width: 100vw; }
a{ text-decoration: none; color: black; }
#header { background-color: rgba(255, 255, 255, 0.487); opacity: 0.95; box-shadow: 0 0 1px 0; backdrop-filter: blur(20px); width: 100vw; height: 67px; display: flex; justify-content: space-between; align-items: center; }

/* SIDE-BAR */
#check { display: none; }
.btn_toggle { position: absolute; top: 10px; left: 16px; cursor: pointer; z-index: 1002; display: flex; align-items: center; justify-content: center; width: 65px; height: 65px; }
.background1 { width: 65px; height: 65px; display: flex; justify-content: center; align-items: center; margin-top: 0.4rem; }
.menu__icon { width: 32px; height: 32px; padding: 4px; display: inline-block; }
.menu__icon span { display: block; width: 100%; height: 0.09rem; border-radius: 2px; background-color: black; box-shadow: 0 .5px 2px 0 hsla(0, 0%, 0%, .2); transition: background-color .4s; position: relative; }
.menu__icon span+span { margin-top: .375rem; }
.menu__icon span:nth-child(1) { animation: ease .5s menu-icon-top-2 forwards; }
.menu__icon span:nth-child(2) { animation: ease .5s menu-icon-scaled-2 forwards; }
.menu__icon span:nth-child(3) { animation: ease .5s menu-icon-bottom-2 forwards; }
#check:checked~.btn_toggle .menu__icon span:nth-child(1) { animation: ease .5s menu-icon-top forwards; background-color: rgb(255, 255, 255); width: 80%; }
#check:checked~.btn_toggle .menu__icon span:nth-child(2) { animation: ease .5s menu-icon-scaled forwards; }
#check:checked~.btn_toggle .menu__icon span:nth-child(3) { animation: ease .5s menu-icon-bottom forwards; background-color: rgb(255, 255, 255); width: 80%; }
#check:not(:checked)~.btn_toggle .menu__icon span:nth-child(1) { animation: ease .5s menu-icon-top-2 forwards; }
#check:not(:checked)~.btn_toggle .menu__icon span:nth-child(2) { animation: ease .5s menu-icon-scaled-2 forwards; }
#check:not(:checked)~.btn_toggle .menu__icon span:nth-child(3) { animation: ease .5s menu-icon-bottom-2 forwards; }
@keyframes menu-icon-top { 0% { top: 0; transform: rotate(0); } 50% { top: .5rem; transform: rotate(0); } 100% { top: .5rem; transform: rotate(45deg); } }
@keyframes menu-icon-top-2 { 0% { top: .5rem; transform: rotate(45deg); } 50% { top: .5rem; transform: rotate(0); } 100% { top: 0; transform: rotate(0); } }
@keyframes menu-icon-bottom { 0% { bottom: 0; transform: rotate(0); } 50% { bottom: .5rem; transform: rotate(0); } 100% { bottom: .5rem; transform: rotate(135deg); } }
@keyframes menu-icon-bottom-2 { 0% { bottom: .5rem; transform: rotate(135deg); } 50% { bottom: .5rem; transform: rotate(0); } 100% { bottom: 0; transform: rotate(0); } }
@keyframes menu-icon-scaled { 50% { transform: scale(0); } 100% { transform: scale(0); } }
@keyframes menu-icon-scaled-2 { 0% { transform: scale(0); } 50% { transform: scale(0); } 100% { transform: scale(1); } }
.sidebar { background: #111; padding: 20px 0; display: flex; flex-direction: column; align-items: center; position: fixed; left: -17rem; height: 95vh; width: 4.5rem; background-color: rgb(0, 0, 0); transition: all 0.2s linear; z-index: 1000; top: 0; border-radius: 1rem; margin: 0.3rem 0 1vh 0; }
#check:checked~.sidebar { left: 0.5rem; }
.hr1 { border: none; border-top: 0.1px solid #6b6666; width: 60%; margin-bottom: 1rem; margin-top: 2.68rem; }
.menu-item { position: relative; display: flex; align-items: center; margin: 20px 0; color: white; text-decoration: none; }
.icon4 { width: 1.5rem; height: 1.5rem; margin-bottom: 0.1rem; }
.profile-btn { margin-top: auto; margin-bottom: 0rem; }
.profile-btn .icon4 { width: 3.8rem; height: 4.5rem; }
@media (max-width: 550px) { .profile-btn { margin-bottom: 6rem; } }
.label { position: absolute; left: 60px; opacity: 0; transform: translateX(-10px); transition: all 0.3s ease; color: black; font-family: Arial, sans-serif; width: max-content; }
.lst-lbl{ left: 70px; top: 20.5px; }
.icon4:hover+.label { opacity: 1; transform: translateX(0); }
.menu-item+hr { display: none; }

/* SUBSCRIBE BUTTON */
.noselect { width: 200px; height: 67px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #e62222; border: none; box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.15); padding-left: 20px; transition: 270ms; }
.noselect .text { position: relative; transform: translateX(35px); color: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 1.4em; font-weight: 200; letter-spacing: 1.5px; }
.noselect .icon { position: absolute; transform: translateX(110px); height: 40px; width: 40px; display: flex; align-items: center; justify-content: center; margin-left: 16px; }
.noselect svg { width: 15px; fill: #eee; }
.noselect:hover { background: #ff3636; }
.noselect:hover .text { color: white; }
@media (min-width: 550px){ .bell{ display: none;} }



@keyframes bellRing { 0% { transform-origin: top; } 15% { transform: rotateZ(15deg); scale: 1.1; } 30% { transform: rotateZ(-15deg); scale: 1.15; } 45% { transform: rotateZ(8deg); scale: 1.2; } 60% { transform: rotateZ(-8deg); scale: 1.25; } 75% { transform: rotateZ(5deg); scale: 1.3; } 100% { transform-origin: top; scale: 1.35; } }

@media (max-width: 550px) { .noselect:hover .bell { animation: none; } .noselect { width: 50px; height: 50px; padding: 0 10px; } .noselect .text { display: none; } .noselect .icon { height: 10px; width: 10px; } .noselect svg { width: 16px; } }
#openPopupBtn { visibility: hidden; opacity: 0; transition: opacity 0.3s ease; }
#openPopupBtn.auth-ready { visibility: visible; opacity: 1; }
.LOGO { font-size: 1.4em; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 300; margin-left: 12vw; letter-spacing: 0.06rem; }
@media (max-width: 768px) { #header { height: 67px; } .LOGO { margin-left: 12vh; font-size: 1.2em; } .noselect { width: 160px; height: 67px; } .noselect .text { font-size: 1.2em; transform: translateX(20px); } .noselect .icon { transform: translateX(80px); } .noselect:hover .icon { width: 150px; border-left: none; transform: translateX(-26px); } .background1 { width: 55px; height: 55px; } .menu__icon { width: 28px; height: 28px; } }

/* FOOTER */
footer { background: #000; padding: 40px 0 0; margin: 0; font-family: Arial, sans-serif; background-color: #111; color: #fff; width: 100vw; min-height: 15rem; flex-shrink: 0; }
footer h2 { margin-left: 8rem; font-size: 1.1rem; font-weight: 100; opacity: 0.85; margin-bottom: 2rem; text-transform: lowercase; }
.footer-container { display: flex; justify-content: space-around; flex-wrap: wrap; border-bottom: 1px solid #222; padding-bottom: 3rem; max-width: 1400px; margin: 0 auto; }
.footer-left { margin-left: 12rem; }
.footer-left ul, .footer-middle ul { list-style: none; padding: 0; margin: 0; }
.footer-left ul li, .footer-middle ul li { margin: 10px 0; }
.footer-left ul li a, .footer-middle ul li a { color: #bbb; text-decoration: none; font-size: 14px; transition: color 0.3s ease; }
.footer-left ul li a:hover, .footer-middle ul li a:hover { color: #fff; }
.footer-middle ul { margin: 1rem 0 0 20rem; position: relative; left: -14rem; }
.vertical-line { border: none; border-left: 1px solid #6b6666; height: 4rem; width: 1rem; padding: 40px 20px 20px; position: absolute; left: 23vw; z-index: 11; margin-top: -0.2rem; margin-left: 15rem; }
.l2 { height: 6rem; left: 49.5vw; margin-top: -1.5rem; }
.footer-right h3 { margin: -1rem 0 1.7rem 0; font-size: 16px; font-weight: 500; letter-spacing: 0.09rem; }
.newsletter-input { width: 14rem; padding: 10px; border: none; margin-bottom: 1rem; background: #c1bebe; color: #302e2e; border-radius: 3px; font-size: 14px; }
.newsletter-input::placeholder { color: #161616; }
.subscribe-btn { padding: 8px 20px; border: none; background: #fff; color: #000; border-radius: 20px; cursor: pointer; font-size: 14px; opacity: 0.8; transition: all 0.3s ease; }
.subscribe-btn:hover { background: red; color: #fff; }
.footer-bottom { text-align: center; font-size: 12px; color: #aaa; line-height: 1.5; padding: 10px 20px; }
.footer-bottom a { color: #aaa; text-decoration: underline; }
.footer-bottom a:hover { color: #fff; }

@media (max-width: 1399px) { .footer-left { margin-left: 20rem; } .footer-middle ul { margin-left: 15rem; left: -10rem; } }
@media (max-width: 1000px) { footer { min-height: auto; } footer h2 { margin-bottom: 2rem; } .footer-container { flex-direction: column; align-items: center; gap: 2rem; padding-bottom: 2rem; } .footer-left, .footer-middle { margin: 0; text-align: center; } .footer-left ul, .footer-middle ul { margin: 0; left: 0; } .vertical-line { display: none; } .footer-right { text-align: center; } .footer-right h3 { margin-top: 0; } .newsletter-input { width: 100%; max-width: 300px; } }

@media (max-width: 550px) {
  .sidebar { width: 69%; border-radius: 0; margin: 0; align-items: start; left: -23.9rem; height: 100vh; }
  #check:checked~.sidebar { left: 0; }
  .menu-item { padding-left: 15px; border: 1px white; }
  .hr1 { border: none; border-top: 0.1px solid #ffffff; width: 100%; margin-bottom: 1rem; margin-top: 1.87rem; }
  .label { opacity: 1; transform: translateX(0px); color: white; }
  .profile-btn { margin-bottom: 3rem; margin-left: 7px; }
  .profile-btn .icon4 { width: 2rem; height: 2rem; }
  .lst-lbl{ top: 8px; }
  .btn_toggle { left: 0; }
  .menu-item+hr { display: block; margin: 0; padding: 0; z-index: 200; transform: translateX(30px); width: 70%; opacity: 0.36; color: transparent; }
  #header { height: auto; justify-content: space-between; width: 100%; height: 50px; padding: 0; }
  .background1 { width: 45px; height: 45px; }
  .menu__icon { width: 24px; height: 24px; margin-top: -30px; }
  .LOGO { position: absolute; left: 50%; transform: translateX(-50%); margin: 0; white-space: nowrap; }
  .noselect { width: 50px; height: 50px; }
  .noselect .text {  transform: translateX(10px); }
  .noselect .icon { transform: translateX(-15px); width: 30px; height: 30px; }
  .noselect:hover .icon { width: 150px; border-left: none; transform: translateX(-75px); }
  footer h2 {  margin: 0 2rem 1rem; text-align: left; }
  .footer-left ul, .footer-middle ul { width: max-content; padding: 0 10px; margin: 0.5rem 1.35rem; width: 30%; }
  .footer-left ul li, .footer-middle ul li { width: max-content; margin: 6px 0; }
  .footer-right h3 {  margin-bottom: 1rem; text-align: left; }
  .newsletter-input { max-width: 220px; min-width: 10px; padding: 8px;  }
  .subscribe-btn { padding: 6px 10px; margin-left: 15px;  height: 30px; }
  .footer-container { gap: 0rem; display: grid; grid-template-columns: 1fr 1fr; }
  .footer-bottom { line-height: 1.6; }
  .footer-left, .footer-middle { text-align: left; margin: 0; }
  .footer-right { margin: 2rem 0 0 2rem; grid-column: 1/ -1; }
  form { display: flex; }
}
@media (max-width: 1000px){
   footer h2 { margin: 0 2rem 1rem; text-align: left; }
  .footer-left ul, .footer-middle ul { width: 80%; padding: 0 10px; margin: 0.5rem 1.35rem;  }
  .footer-left ul li, .footer-middle ul li { width: 100%; margin: 6px 0; }
  .footer-right h3 { margin-bottom: 1rem; text-align: left; }
  .newsletter-input { max-width: 220px; min-width: 10px; padding: 8px; }
  .subscribe-btn { padding: 6px 10px; margin-left: 15px; height: 30px; }
  .footer-container { gap: 0rem; display: grid; grid-template-columns: 1fr 1fr; }
  .footer-bottom { line-height: 1.6; }
  .footer-left, .footer-middle { text-align: center; margin: 0; }
  .footer-right { margin: 3rem 0 0 21vw; grid-column: 1/ -1; }
  form { display: flex; }
  .footer-middle ul { text-align: left; }
  .footer-left ul li { text-align: left; width: max-content; }
  .footer-left ul { width: max-content; margin: 0 auto; }
  }

@media (max-width: 550px) {
  .sidebar { width: 69%; border-radius: 0; margin: 0; align-items: start; left: -23.9rem; height: 100vh; }
  #check:checked~.sidebar { left: 0; }
  .menu-item { padding-left: 15px; border: 1px white; }
  .hr1 { border: none; border-top: 0.1px solid #ffffff; width: 100%; margin-bottom: 1rem; margin-top: 1.87rem; }
  .label { opacity: 1; transform: translateX(0px); color: white; }
  .profile-btn { margin-bottom: 3rem; margin-left: 7px; }
  .profile-btn .icon4 { width: 2rem; height: 2rem; }
  .lst-lbl{ top: 8px; }
  .btn_toggle { left: 0; }
  .menu-item+hr { display: block; margin: 0; padding: 0; z-index: 200; transform: translateX(30px); width: 70%; opacity: 0.36; color: transparent; }
  #header { height: auto; justify-content: space-between; width: 100%; height: 50px; padding: 0; }
  .background1 { width: 45px; height: 45px; }
  .menu__icon { width: 24px; height: 24px; margin-top: -30px; }
  .LOGO { position: absolute; left: 50%; transform: translateX(-50%); font-size: 1.1em; margin: 0; white-space: nowrap; }
  .noselect { width: 50px; height: 50px; }
  .noselect .text { font-size: 1em; transform: translateX(10px); }
  .noselect .icon { transform: translateX(-15px); width: 30px; height: 30px; }
  .noselect:hover .icon { width: 150px; border-left: none; transform: translateX(-75px); }
  footer h2 { font-size: 0.95rem; margin: 0 2rem 1rem; text-align: left; }
  .footer-left ul, .footer-middle ul { width: max-content; padding: 0 10px; margin: 0.5rem 1.35rem; width: 30%; }
  .footer-left ul li, .footer-middle ul li { width: max-content; margin: 6px 0; }
  .footer-left ul li a, .footer-middle ul li a { font-size: 12px; }
  .footer-right h3 { font-size: 14px; margin-bottom: 1rem; text-align: left; }
  .newsletter-input { max-width: 220px; min-width: 10px; padding: 8px; font-size: 13px; }
  .subscribe-btn { padding: 6px 10px; margin-left: 15px; font-size: 12px; height: 30px; }
  .footer-container { gap: 0rem; display: grid; grid-template-columns: 1fr 1fr; }
  .footer-bottom { font-size: 10px; line-height: 1.6; }
  .footer-left, .footer-middle { text-align: left; margin: 0; }
  .footer-right { margin: 2rem 0 0 2rem; grid-column: 1/ -1; }
  form { display: flex; }
}

@media (max-width: 375px) { footer h2 { font-size: 0.9rem; } .footer-left ul li a, .footer-middle ul li a { font-size: 11px; } .newsletter-input { max-width: 180px; } .footer-bottom { font-size: 9px; } }

/* POPUP & UTILITY */
.hidden { display: none !important; }
.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px); opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease; display: flex; justify-content: center; align-items: center; z-index: 1000; }
.overlay.active { opacity: 1; visibility: visible; }
.popup.pop-card { background: white; width: 90%; max-width: 600px; height: 30%; border-radius: 10px; padding: 30px 40px; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); transform: scale(0.8); transition: transform 0.3s ease; }
.overlay.active .popup.pop-card { transform: scale(1); }
.pop-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
.pop-logo { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 1.4rem; font-weight: 200; color: #333; letter-spacing: 0.5px; }
.text-red { color: #d73634; }
.close-icon-wrapper { cursor: pointer; color: #ff4444; transition: transform 0.2s ease; display: flex; align-items: center; justify-content: center; }
.close-icon-wrapper:hover { transform: scale(1.1); color: #cc0000; }
.pop-body { display: flex; flex-direction: column; align-items: center; gap: 1.2rem; margin-bottom: 30px; }
#view-options { margin-top: 09px; }
.sm-btn { display: flex; align-items: center; justify-content: center; width: 300px; max-width: 300px; padding: 12px 20px; background-color: white; border: 1px solid #777; border-radius: 50px; font-family: "Roboto", sans-serif; font-size: 0.89rem; color: #333; cursor: pointer; transition: background 0.2s ease; position: relative; height: 35px; }
.sm-btn img { filter: grayscale(100%); }
#btn-to-email { display: none;}
.sm-btn:hover, #text-twitter:hover { background-color: #d73634; color: white; border-color: #d73634; }
.btn-icon { width: 24px; height: 24px; position: absolute; left: 20px; }
.email-icon { stroke: #444; stroke-width: 1.2px; }
.pop-footer { text-align: center; font-family: "Roboto", sans-serif; font-size: 0.9rem; color: #555; margin-bottom: 10px; }
.pop-footer a { color: #2d4dcf; text-decoration: underline; text-underline-offset: 3px; }
#view-email { padding: 30px; padding-top: 10px; }
.pop-label { text-align: left; font-family: "Roboto", sans-serif; font-weight: 400; font-size: 1.1rem; margin-bottom: 15px; color: #333; }
.pop-form { display: flex; gap: 10px; margin-bottom: 20px; }
.pop-input { flex-grow: 4; padding: 12px 15px; border: none; background-color: #f0f0f0; border-radius: 10px; font-size: 1rem; outline: none; color: #333; }
.pop-input::placeholder { opacity: 0.32; }
.pop-btn-continue { flex-grow: 3.2; background-color: black; color: white; border: none; padding: 0 25px; border-radius: 10px; font-size: 1rem; font-weight: 100; cursor: pointer; font-family: "Roboto", sans-serif; transition: opacity 0.2s; }
.pop-btn-continue:hover { opacity: 0.8; }
.pop-info { color: #d73634; font-size: 0.9rem; font-weight: 300; text-align: left; line-height: 1.4; margin-bottom: 30px; }
.pop-back-wrap { text-align: right; position: fixed; top: 90%; left: 90%; }
.pop-back { color: hsla(1, 67%, 52%, 0.5); cursor: pointer; font-size: 0.95rem; transition: color 0.2s; }
.pop-back:hover { color: hsla(1, 67%, 52%, 0.7); }
@media (max-width: 480px) { .pop-card { padding: 25px 20px; } .pop-form { flex-direction: column; } .pop-btn-continue { padding: 12px; width: 100%; } }
.checkbox-row { display: flex; align-items: flex-start; gap: 12px; margin-top: 15px; }
.pop-check { display: none; }
.checkbox-row label { position: relative; cursor: pointer; padding-left: 28px; line-height: 1.6; user-select: none; color: #d73634; }
.checkbox-row label::before { content: ""; position: absolute; left: 0; top: 2px; width: 15px; height: 15px; border: 1.5px solid #333; background-color: #fff; border-radius: 4px; }
.checkbox-row label::after { content: ""; position: absolute; left: 6px; top: 4.5px; width: 5px; height: 10px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg) scale(0); opacity: 0; }
.pop-check:checked+label::before { background-color: #1f1111; border-color: #2d1414; }
.pop-check:checked+label::after { opacity: 1; transform: rotate(45deg) scale(1); }
.pop-check:checked+label { color: #ab3232; }

/* OTP STYLES */
.otp-heading { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 1.2rem; font-weight: 700; margin-bottom: 10px; color: #000; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px; }
.otp-subtext { font-family: "Roboto", sans-serif; color: #333; font-size: 0.84rem; margin-bottom: 25px; margin-top: 20px; }
.email-highlight { font-weight: 500; text-decoration: underline; cursor: pointer; }
.otp-input-group { display: flex; justify-content: center; gap: 12px; margin-bottom: 25px; }
.otp-digit { width: 65px; height: 40px; border: none; background-color: #f0f0f0; border-radius: 8px; font-size: 1.2rem; text-align: center; font-family: "Roboto", sans-serif; outline: none; transition: all 0.2s; color: rgb(51 51 51 / 40%); }
.otp-digit:focus { background-color: #e0e0e0; transform: scale(1.05); }
.black-btn { background-color: #000; color: white; width: 150px; margin-bottom: 15px; padding: 10px 0; font-weight: 300; font-size: 0.9rem; border-radius: 8px; letter-spacing: 1px; }
.black-btn:hover { background-color: #333; }
.resend-wrapper { text-align: center; font-size: 0.8rem; color: #d73634; font-family: monospace; cursor: default; padding-bottom: 10px; display: flex; justify-content: center; align-items: center; }
#resend-timer { font-family: monospace; margin-left: 5px; }
.resend-active { cursor: pointer; font-weight: normal; }
.otp-toast { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background-color: #333; color: white; padding: 8px 24px; border-radius: 3.5px; font-size: 0.85rem; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 20; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); }
.otp-toast.show { opacity: 1; visibility: visible; }
#view-otp { text-align: center; }
.otp-digit::-webkit-outer-spin-button, .otp-digit::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.otp-digit[type="number"] { -moz-appearance: textfield; }
@media (max-width: 1024px) { .popup.pop-card { height: auto; min-height: 300px; max-height: 90vh; overflow-y: auto; width: 70%; padding: 40px; } #view-email { padding-bottom: 5px; } .popup.pop-card { padding-bottom: 20px; } }
@media (max-width: 768px) { .popup.pop-card { width: 85%; padding: 30px 25px; } .otp-digit { width: 60px; height: 45px; font-size: 1.1rem; } .otp-input-group { gap: 10px; } #view-email { padding-bottom: 5px; } .popup.pop-card { padding-bottom: 10px; } }
@media (max-width: 550px) { .popup.pop-card { width: 95%; height: auto; min-height: 30%; max-height: 85vh; overflow-y: auto; padding: 20px 15px; } .pop-header { margin-bottom: 20px; } .pop-logo { font-size: 1.2rem; } .sm-btn { width: 450px; max-width: 100%; font-size: 0.85rem; padding: 10px; } .pop-input { width: 100%; box-sizing: border-box; } .otp-input-group { gap: 8px; } .otp-digit { width: 50px; height: 45px; font-size: 1rem; padding: 0; border-radius: 6px; } .otp-heading { font-size: 1rem; } #view-email { padding-bottom: 5px; } }
@media (max-width: 480px) { .popup.pop-card { width: 85%; padding: 20px 15px; min-height: 30%; } .sm-btn { width: 275px; max-width: 100%; font-size: 0.9rem; } .otp-digit { width: 50px; height: 45px; font-size: 1rem; } .otp-input-group { gap: 8px; } .pop-header { margin-bottom: 20px; } .pop-logo { font-size: 1.2rem; } #view-email { padding-bottom: 5px; } }

/* SEARCH CSS */
.search-wrapper { position: fixed; bottom: 2.4rem; right: 3rem; z-index: 100; }
.search-toggle-btn { background-color: #000000; color: white; border: none; border-radius: 50%; width: 60px; height: 60px; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); transition: transform 0.3s ease; }
.search-popup-container { position: absolute; bottom: 5px; right: 70px; width: 0; height: 50px; background-color: rgb(222, 222, 222); border-radius: 25px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); display: flex; align-items: center; padding: 0; opacity: 0; visibility: hidden; transition: all 0.4s ease; overflow: hidden; }
.search-popup-container.active { width: 300px; opacity: 1; visibility: visible; padding: 0 1rem; }
.search-toggle-btn:active .search-icon { animation: spin 3s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.search-input { width: 100%; height: 100%; border: none; background: transparent; font-size: 1rem; outline: none; }
.filter-icon1, .filter-icon2 { display: none; width: 1.5rem; height: 1.5rem; filter: invert(100%); }
.filter-icon2 { width: 1.48rem; height: 1.48rem; }
.filter-options-container { position: absolute; bottom: 70px; right: 0; background-color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); padding: 10px; display: none; flex-wrap: wrap; gap: 8px; width: 250px; z-index: 100; }
.filter-options-container.visible { display: flex; }
.filter-tag input[type="checkbox"] { display: none; }
.filter-tag label { display: block; padding: 6px 12px; background-color: #f0f0f0; border-radius: 16px; cursor: pointer; transition: background-color 0.3s; user-select: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.filter-tag input[type="checkbox"]:checked+label { background-color: #e62222; color: white; }
.search-icon, .filter-icon1, .filter-icon2 { transition: transform 0.5s ease, opacity 0.5s ease; display: inline-block; }
.rotate-out { transform: rotate(360deg) scale(0); opacity: 0; }
.rotate-in { transform: rotate(0deg) scale(1); opacity: 1; }
.search-results-box { position: absolute; bottom: 7vh; right: 10px; width: 390px; display: none; z-index: 90; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 12px; overflow: hidden; }
.search-scroll-view.few-results { mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 100%); }
@media (max-height: 850px) { .search-wrapper{ bottom: 0.7rem; } .search-scroll-view { mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 100%) !important; -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 100%) !important; } .search-results-box { min-height: 72vh; } }
.search-scroll-view { max-height: 57vh; overflow-y: auto; scrollbar-width: thin; padding: 10px 0; mask-image: none; -webkit-mask-image: none; }
.search-results-box.active { display: block; animation: slideUp 0.3s ease-out; }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.btn-read-more { display: block; width: 100%; padding: 12px; background: transparent; border: none; border-top: 1px solid #eee; color: #d73634; font-size: 0.9rem; font-weight: 600; cursor: pointer; text-align: center; font-family: inherit; margin-top: 5px; transition: background 0.2s; }
.btn-read-more:hover { background-color: #f9f9f9; text-decoration: underline; }
.result-card { background-color: #f2f1f1; border-radius: 8px; padding: 12px 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05); transition: transform 0.2s; cursor: pointer; text-decoration: none; display: block; color: inherit; }
.result-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }
.result-card h4 { margin: 0 0 6px 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 0.95rem; font-weight: 700; line-height: 1.3; color: #000; text-transform: uppercase; }
.result-card p { font-size: 0.85rem; color: #555; margin: 0 0 8px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.result-date { font-size: 0.75rem; font-weight: bold; color: #d73634; text-align: right; display: block; }
.highlight-red { color: #d73634; font-weight: bold; }
@media (max-width: 1024px) { .search-results-box { width: 340px; right: 59px; } .search-wrapper { bottom: 1.5rem; right: 2rem; } }
@media (max-width: 768px) { .search-wrapper { bottom: 1rem; right: 2rem; } .search-scroll-view{ max-height: 80vh; } .search-results-box { min-height: 80vh; width: 340px; bottom: 60px; right: 62px; } }
@media (max-width: 550px) { .search-wrapper { bottom: 1rem; right: 1rem; } .search-toggle-btn { width: 50px; height: 50px; } .search-popup-container { bottom: 5px; right: 60px; height: 42px; } .search-popup-container.active { width: auto; min-width: 85vw; } .filter-options-container { bottom: 60px; right: 0; width: max-content; max-width: 85vw; padding: 8px; } .filter-tag label { padding: 4px 10px; font-size: 0.85rem; } .search-results-box { width: 92.2vw; right: -5px; bottom: 55px; max-height: 82vh; border-radius: 12px; backdrop-filter: blur(12px); } .result-card h4 { font-size: 0.9rem; } .result-card p { font-size: 0.8rem; -webkit-line-clamp: 2; } }
@media (max-width: 550px) { .search-wrapper { bottom: 1rem; right: 1.2rem; } .search-toggle-btn { width: 50px; height: 50px; } .search-popup-container { bottom: 5px; right: 60px; height: 43px; } .filter-options-container { bottom: 60px; right: 0; box-shadow: 0 1px 1px rgba(0, 0, 0, 0.15); padding: 8px; width: max-content; } .filter-tag label { padding: 3px 7px; font-size: 0.85rem; } .search-popup-container.active { min-width: 65vw; width: auto; } }
@media (max-width: 375px) { .search-results-box { width: 92vw; right: -5px; } }
@media (max-width: 650px), (max-height: 850px) { .search-scroll-view { mask-image: linear-gradient(to bottom, transparent 0%, black 0%, black 100%) !important; -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 0%, black 100%) !important; } }
body { display: flex; flex-direction: column; min-height: 100vh; margin: 0; }
.ma-main { flex: 1; width: 100%; }
footer { flex-shrink: 0; }
.profile-popup { z-index: 100; display: none; position: fixed; left: 80px; top: 78vh; width: 200px; background-color: #f2f2f2; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 1005; flex-direction: column; padding-bottom: 5px; opacity: 0; transform: translateX(-10px); transition: opacity 0.2s, transform 0.2s; border: 0.5px solid rgb(213, 207, 207); text-align: center; border-radius: 10px; }
.profile-popup.active { display: flex; opacity: 1; transform: translateX(0); }
.profile-header { padding: 15px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 16px; font-weight: 400; color: #000; border-bottom: 1px solid #d1d1d1; cursor: default; white-space: nowrap; overflow: hidden; }
.profile-menu-item { padding: 12px 20px; text-decoration: none; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 15px; font-weight: 300; transition: background-color 0.2s; display: block; }
.profile-menu-item:hover { background-color: #e6e6e6; }
.profile-divider { border: none; border-top: 1px solid #d1d1d1; margin: 5px 20px; width: auto; }
@media (max-width: 550px) { .profile-popup { left: 75px; bottom: 80px; } }
/* For shorter screens (Laptops/Tablets) */
@media (max-height: 850px) {
   .profile-popup {
       top: 75vh;
   }
}
/* For very short screens (Mobile Landscape or Small Windows) */
@media (max-height: 750px) {
   .profile-popup {
   top: 70vh;
   }
}
@media (max-height: 620px) {
   .profile-popup {
       top: 65vh;
   }
}





.pop-body {margin-top : 33px;}
`;

// =========================================================================
//  EMBEDDED HTML (Paste your layout.html content here)
// =========================================================================
const layoutHTML = `
<div id="source-header">
    <header id="header">
        <div class="main_box">
            <input type="checkbox" id="check" />
            <label for="check" class="btn_toggle">
                <div class="background1">
                    <div class="menu__icon" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </label>
            <div class="sidebar">
                <hr class="hr1">
                <a href="/main/index.html" class="menu-item">
                    <img src="/assets/home.png" alt="img" class="icon4">
                    <span class="label">home</span>
                </a>
                <hr>
                <a href="/students/Students.html" class="menu-item">
                    <img src="/assets/Student Icon.png" alt="img" class="icon4">
                    <span class="label">students</span>
                </a>
                <hr>
                <a href="/others/x-error.html" class="menu-item">
                    <img src="/assets/Tech Icons.png" alt="img" class="icon4">
                    <span class="label">artificial intelligence</span>
                </a>
                <a href="javascript:void(0)" class="menu-item profile-btn" id="profileTrigger" style="display: none;">
                    <img src="/assets/profile Image.png" alt="img" class="icon4" id="responsiveImg">
                    <span class="label lst-lbl">profile</span>
                </a>
                <div class="profile-popup" id="profilePopup">
                    <div class="profile-header" id="profileName">Loading...</div>
                    <a href="/profile pages/user.html" class="profile-menu-item">profile</a>
                    <a href="#" class="profile-menu-item">help</a>
                    <hr class="profile-divider">
                    <a href="#" class="profile-menu-item" id="btn-signout">sign out</a>
                </div>
            </div>
        </div>
        <a href="/main/index.html" class="LOGO">bai.news</a>
        <button id="openPopupBtn" class="noselect"><span class="text">subscribe</span>
            <span class="icon"> <svg viewBox="0 0 448 512" class="bell"><path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"></path></svg></span>
        </button>
    </header>
</div>

<div id="source-popup">
    <div id="popupOverlay" class="overlay">
        <div class="popup pop-card">
            <div class="pop-header">
                <span class="pop-logo">b<span class="text-red">ai</span>.news</span>
                <div class="close-icon-wrapper" id="closePopupBtn">
                    <svg  width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
            </div>
            <div id="view-options">
                <div class="pop-body">
                    <button class="sm-btn" id="google-login-btn">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" class="btn-icon">
                        <span id="text-google">Sign up with Google</span>
                    </button>
                    <a href="/error-page/x-error.html"><button class="sm-btn">
                        <img src="https://img.icons8.com/?size=256w&id=xgCVUXwsgAmA&format=png" alt="Google" class="btn-icon">
                        <span id="text-twitter">Sign up with X</span>
                    </button></a>
                    <button class="sm-btn" id="btn-to-email">
                        <svg class="btn-icon email-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                            <path d="M16 2v4M8 2v4M3 10h18"></path>
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        <span id="text-email">Sign up with email</span>
                    </button>
                </div>
                <div class="pop-footer">
                    <span id="text-footer-prompt">Already have an account? </span>
                    <a href="#" id="toggle-auth-mode">Sign in</a>
                </div>
            </div>
            <div id="view-email" class="hidden">
                <h3 class="pop-label">Your email</h3>
                <form class="pop-form" id="form-email">
                    <input type="email" id="email-input" placeholder="custmr.team@gmail.com" class="pop-input" required>
                    <button type="submit" class="pop-btn-continue" id="btn-continue">continue</button>
                </form>
                <p class="pop-info checkbox-row">
                    <input type="checkbox" id="newsletter-check" class="pop-check">
                    <label for="newsletter-check">
                        Join our mailing list to receive the latest scholarships news and updates from our team.
                    </label>
                </p>
                <div class="pop-back-wrap">
                    <span class="pop-back" id="btn-back">back</span>
                </div>
            </div>
            <div id="view-otp" class="hidden">
                <div id="otp-toast" class="otp-toast">OTP Sent!</div>
                <h2 class="otp-heading">VE<span class="text-red">RI</span>FY EM<span class="text-red">AI</span>L AD<span class="text-red">DRE</span>SS</h2>
                <p class="otp-subtext">
                    OTP sent to <span id="display-email" class="email-highlight">user@example.com</span>
                </p>
                <div class="otp-input-group">
                    <input type="text" inputmode="numeric" maxlength="1" class="otp-digit">
                    <input type="text" inputmode="numeric" maxlength="1" class="otp-digit">
                    <input type="text" inputmode="numeric" maxlength="1" class="otp-digit">
                    <input type="text" inputmode="numeric" maxlength="1" class="otp-digit">
                    <input type="text" inputmode="numeric" maxlength="1" class="otp-digit">
                    <input type="text" inputmode="numeric" maxlength="1" class="otp-digit">
                </div>
                <button class="pop-btn-continue black-btn" id="btn-verify-otp">Create</button>
                <div class="resend-wrapper">
                    <span id="resend-text">resend</span>
                    <span id="resend-timer"></span>
                </div>
            </div>
        </div>
    </div>
</div>

<div id="source-footer">
    <footer>
        <h2>bai.news</h2>
        <div class="footer-container">
            <div class="footer-left">
                <ul>
                    <li><a href="/main/index.html">Home</a></li>
                    <li><a href="/students/Students.html">Students</a></li>
                    <li><a href="#">Tech</a></li>
                    <li><a href="#">Investors</a></li>
                </ul>
            </div>
            <hr class="vertical-line l1">
            <div class="footer-middle">
                <ul>
                    <li><a href="/others/privacy-policy.html">Privacy Policy</a></li>
                    <li><a href="/others/about.html">About us</a></li>
                </ul>
            </div>
            <hr class="vertical-line l2">
            <div class="footer-right">
                <h3>Newsletter</h3>
                <form>
                    <input type="email" class="newsletter-input" placeholder="Email">
                    <br>
                    <button type="submit" class="subscribe-btn">Subscribe</button>
                </form>
            </div>
        </div>
        <div class="footer-bottom">
            Copyright 2025 bai.news. All rights reserved.
            The bai.news is not responsible for the content of external sites.
            <a href="#">Read about our approach to external linking.</a>
        </div>
    </footer>
</div>

<div id="source-search">
    <div class="search-wrapper">
        <div id="search-results-box" class="search-results-box"></div>
        <div class="filter-options-container" id="filter-options-container">
            <div class="filter-tag">
                <input type="checkbox" id="filter-ai" name="filter-tags" value="ai">
                <label for="filter-ai">AI</label>
            </div>
            <div class="filter-tag">
                <input type="checkbox" id="filter-tech" name="filter-tags" value="tech">
                <label for="filter-tech">Tech</label>
            </div>
            <div class="filter-tag">
                <input type="checkbox" id="filter-gpt" name="filter-tags" value="gpt">
                <label for="filter-gpt">GPT</label>
            </div>
            <div class="filter-tag">
                <input type="checkbox" id="filter-india" name="filter-tags" value="india">
                <label for="filter-india">India</label>
            </div>
        </div>
        <div class="search-popup-container" id="search-popup-container">
            <input type="text" placeholder="Search..." id="searchInput" class="search-input">
        </div>
        <button class="search-toggle-btn" id="search-toggle-btn">
            <img src="/assets/Filter empty Icon.png" alt="Filter" class="filter-icon1" />
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <img src="/assets/Filter filled Icon.png" alt="filter" class="filter-icon2" />
        </button>
    </div>
</div>
`;


// ==========================================
// 1. MASTER LAYOUT LOADER (Executes First)
// ==========================================
async function loadLayout() {
    try {
        // 1. Inject CSS
        const styleTag = document.createElement('style');
        styleTag.textContent = layoutCSS;
        document.head.appendChild(styleTag);

        // 2. Parse HTML String (No fetch required!)
        const parser = new DOMParser();
        const doc = parser.parseFromString(layoutHTML, 'text/html');

        // A. Inject Header
        const headerContent = doc.getElementById('source-header').innerHTML;
        const globalHeader = document.getElementById('global-header');
        if (globalHeader) globalHeader.innerHTML = headerContent;

        // B. Inject Footer
        const footerContent = doc.getElementById('source-footer').innerHTML;
        const globalFooter = document.getElementById('global-footer');
        if (globalFooter) globalFooter.innerHTML = footerContent;

        // C. Inject Popup (Append to bottom)
        const popupContent = doc.getElementById('source-popup').innerHTML;
        document.body.insertAdjacentHTML('beforeend', popupContent);

        // D. INJECT SEARCH WRAPPER
        const searchContent = doc.getElementById('source-search').innerHTML;
        document.body.insertAdjacentHTML('beforeend', searchContent);

        // E. START LOGIC (Now that all elements exist)
        initGlobalLogic();

    } catch (error) {
        console.error('Error loading layout:', error);
    }
}

// ==========================================
// 2. GLOBAL INIT (The Coordinator)
// ==========================================
function initGlobalLogic() {

    // 1. Initialize Popup (Login/Signup)
    if (typeof initPopupLogic === 'function') {
        initPopupLogic();
    }

    // 2. Initialize Search
    initSearchLogic();

    // 3. Initialize Responsive Profile Image
    initResponsiveProfile();

    // 4. Initialize Footer Newsletter
    initFooterNewsletter();

    // 5. Initialize Share Icons
    initShareLogic();

    // 6. Highlight Sidebar Link (Active Page)
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';
    const menuLinks = document.querySelectorAll('.menu-item');
    menuLinks.forEach(link => {
        if (link.getAttribute('href').split('/').pop() === currentPage) {
            link.classList.add('active-page');
        }
    });

    // 7. Hamburger Menu Logic
    const btn = document.querySelector('.menu__icon');
    if (btn) {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
    }
}

// ==========================================
// 3. SHARE ICON LOGIC
// ==========================================
function initShareLogic() {
    // A. Toggle Filled/Unfilled Icon
    const shareLink = document.querySelector('a:has(.s-icon1)');
    const shareIcon = shareLink ? shareLink.querySelector('.s-icon1') : null;

    if (shareLink && shareIcon) {
        const unfilledIconPath = "/assets/share icon unfilled.png";
        const filledIconPath = "/assets/share icon filled.png";

        shareLink.addEventListener('click', function (event) {
            event.preventDefault();
            if (shareIcon.src.includes("unfilled")) {
                shareIcon.src = filledIconPath;
            } else {
                shareIcon.src = unfilledIconPath;
            }
        });

        document.addEventListener('click', function (event) {
            if (!shareLink.contains(event.target)) {
                if (shareIcon.src.includes("filled")) {
                    shareIcon.src = unfilledIconPath;
                }
            }
        });
    }

    // B. Web Share API Logic
    if (shareIcon) {
        const shareBtnParent = shareIcon.parentElement;
        shareBtnParent.addEventListener('click', async (e) => {
            e.preventDefault();
            const articleTitle = document.querySelector('#news-headline')?.textContent || document.title;
            const articleUrl = window.location.href;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: articleTitle,
                        text: `${articleTitle}\n\nRead more here:`,
                        url: articleUrl
                    });
                } catch (error) {
                    if (error.name !== 'AbortError') console.error('Error sharing:', error);
                }
            } else {
                // Fallback or do nothing
                console.log('Share API not supported on this browser');
            }
        });
    }
}

// ==========================================
// 4. SEARCH LOGIC (Unified: Client-Side)
// ==========================================
export function initSearchLogic() {
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchPopupContainer = document.getElementById('search-popup-container');
    const filterOptionsContainer = document.getElementById('filter-options-container');
    const searchInput = document.getElementById('searchInput');
    const resultsBox = document.getElementById('search-results-box');
    const filterCheckboxes = document.querySelectorAll('input[name="filter-tags"]');

    if (!searchToggleBtn || !searchInput || !resultsBox) return;

    let clickCount = 0;
    let hasTyped = false;

    // --- Visual Toggles ---
    const imgSearch = searchToggleBtn.querySelector('.search-icon');
    const imgFilterEmpty = searchToggleBtn.querySelector('.filter-icon1');
    const imgFilterFilled = searchToggleBtn.querySelector('.filter-icon2');

    function updateImages(showImage) {
        if (imgSearch) imgSearch.style.display = 'none';
        if (imgFilterEmpty) imgFilterEmpty.style.display = 'none';
        if (imgFilterFilled) imgFilterFilled.style.display = 'none';

        if (showImage === 1 && imgSearch) imgSearch.style.display = 'block';
        if (showImage === 2 && imgFilterEmpty) imgFilterEmpty.style.display = 'block';
        if (showImage === 3 && imgFilterFilled) imgFilterFilled.style.display = 'block';
    }
    updateImages(1); 

    // --- Click Handler ---
    searchToggleBtn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        clickCount++;

        if (clickCount === 1) { // Open Search
            searchWrapper.classList.add('active');
            searchPopupContainer.classList.add('active');
            filterOptionsContainer.classList.remove('visible');
            searchInput.focus();
            updateImages(2);

            // Pre-fetch Data
            if (!window.cachedSearchData) {
                resultsBox.innerHTML = '<p style="padding:10px; color:#888;">Loading Search Index...</p>';
                await fetchAllSearchData();
                resultsBox.innerHTML = ''; 
            }

        } else { // Toggle Filter
            if (clickCount % 2 === 0) {
                filterOptionsContainer.classList.add('visible');
                updateImages(3);
            } else {
                filterOptionsContainer.classList.remove('visible');
                updateImages(2);
            }
        }
    });

    // --- Close on Click Outside ---
    document.addEventListener('click', (e) => {
        if (!searchWrapper || !searchWrapper.classList.contains('active')) return;

        if (!searchWrapper.contains(e.target)) {
            closeSearch();
        } else if (!filterOptionsContainer.contains(e.target) && e.target !== searchToggleBtn && !resultsBox.contains(e.target)) {
            if (filterOptionsContainer.classList.contains('visible')) {
                filterOptionsContainer.classList.remove('visible');
                clickCount = 1;
                updateImages(2);
            }
        }
    });

    function closeSearch() {
        searchWrapper.classList.remove('active');
        searchPopupContainer.classList.remove('active');
        filterOptionsContainer.classList.remove('visible');
        resultsBox.classList.remove('active');
        clickCount = 0;
        hasTyped = false;
        updateImages(1);
    }

    // --- Search Execution ---
    async function performSearch() {
        if (window.location.pathname.includes('multi-article')) {
            resultsBox.classList.remove('active');
            return;
        }

        const query = searchInput.value.toLowerCase().trim();
        hasTyped = true;

        const selectedTags = Array.from(filterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value.toLowerCase());

        if (query.length === 0 && selectedTags.length === 0) {
            resultsBox.classList.remove('active');
            resultsBox.innerHTML = "";
            return;
        }

        let database = window.cachedSearchData;
        if (!database) {
            database = await fetchAllSearchData();
        }

        const filteredData = database.filter(article => {
            const matchesText = !query ||
                article.searchTitle.includes(query) ||
                article.searchSummary.includes(query);
            const matchesTags = selectedTags.length === 0 ||
                selectedTags.some(tag => article.searchTags.includes(tag));
            return matchesText && matchesTags;
        });

        displaySearchResults(filteredData, query);
    }

    searchInput.addEventListener('input', performSearch);
    filterCheckboxes.forEach(cb => cb.addEventListener('change', performSearch));

    // --- Display Results ---
    function displaySearchResults(data, query) {
        if (data.length === 0) {
            resultsBox.innerHTML = `<div class="search-scroll-view"><div style="text-align:center; color:#888; padding:10px;">No matching results.</div></div>`;
            resultsBox.classList.add('active');
            return;
        }

        resultsBox.innerHTML = ''; 
        const viewClass = data.length < 5 ? "search-scroll-view few-results" : "search-scroll-view";
        
        const scrollView = document.createElement('div');
        scrollView.className = viewClass;
        resultsBox.appendChild(scrollView);
        resultsBox.classList.add('active');

        const html = data.map(article => {
            let dateStr = "";
            if (article.datePosted) {
                let dateObj = typeof article.datePosted.toDate === 'function' ? article.datePosted.toDate() : new Date(article.datePosted);
                dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }

            const hlTitle = highlightText(article.title, query, 'red');
            const hlSummary = highlightText(article.summary, query, 'bold');

            return `
            <a href="/articles/article.html?id=${article.id}" class="result-card">
                <h4 style="font-family: 'Inter', sans-serif;">${hlTitle}</h4>
                <p style="font-family: sans-serif; font-weight: 300">${hlSummary}</p>
                <span class="result-date">${dateStr}</span>
            </a>
            `;
        }).join('');

        scrollView.innerHTML = html;

        if (data.length >= 5) {
            scrollView.addEventListener('scroll', function() {
                if (hasTyped && this.scrollTop > 0) {
                    const fadeDistance = 60; 
                    let alpha = 1 - Math.min(this.scrollTop / fadeDistance, 1);
                    const mask = `linear-gradient(to bottom, rgba(0,0,0,${alpha}) 0%, black 10%, black 100%)`;
                    this.style.maskImage = mask;
                    this.style.webkitMaskImage = mask;
                } else {
                    this.style.maskImage = "none";
                    this.style.webkitMaskImage = "none";
                }
            });
        }
    }

    function highlightText(text, query, type) {
        if (!query || !text) return text || "";
        const safeText = text.replace(/(<([^>]+)>)/gi, "");
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        
        if (type === 'red') return safeText.replace(regex, '<span class="highlight-red">$1</span>');
        return safeText.replace(regex, '<strong>$1</strong>');
    }
}

// ==========================================
// 5. RESPONSIVE PROFILE IMAGE
// ==========================================
function initResponsiveProfile() {
    const myImg = document.getElementById('responsiveImg');
    const desktopImg = "/assets/profile Image.png";
    const mobileImg = "/assets/Customer Icon Windows 10.png"; 

    function updateImageSource() {
        if (!myImg) return;
        if (window.innerWidth <= 550) {
            if (!myImg.src.includes("Customer Icon Windows 10")) myImg.src = mobileImg;
        } else {
            if (!myImg.src.includes("profile Image")) myImg.src = desktopImg;
        }
    }
    updateImageSource();
    window.addEventListener('resize', updateImageSource);
}

// ==========================================
// 6. FOOTER NEWSLETTER LOGIC
// ==========================================
function initFooterNewsletter() {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('footer button');
        if (btn) {
            e.preventDefault();
            const input = document.querySelector('footer input[type="email"]');
            if (input && input.value.includes('@')) {
                const originalText = btn.innerText;
                btn.innerText = "Saving...";
                await saveToNewsletterList(input.value);
                btn.innerText = originalText;
                input.value = "";
            } else {
                alert("Please enter a valid email");
            }
        }
    });
}

// ==========================================
// 7. EXECUTE ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', loadLayout);