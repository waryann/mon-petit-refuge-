/**
 * Soirée Ciné-Dîner — Frontend Interactions
 * Animations premium avec GSAP, Lenis (Smooth Scroll), SplitType & tsParticles
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. INITIALISATION LENIS (SMOOTH SCROLL)
  // ==========================================
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Easing plus doux
    direction: 'vertical', // vertical, horizontal
    gestureDirection: 'vertical', // vertical, horizontal, both
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
  });

  // Synchronisation Lenis et GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);
  
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  
  gsap.ticker.lagSmoothing(0);


  // ==========================================
  // 2. TSPARTICLES (POUSSIÈRE D'OR MAGIQUE)
  // ==========================================
  if (document.getElementById('tsparticles')) {
    tsParticles.load("tsparticles", {
      fpsLimit: 60,
      particles: {
        number: {
          value: 40,
          density: { enable: true, value_area: 800 }
        },
        color: { value: ["#d4a017", "#f4c542", "#ffffff"] },
        shape: { type: "circle" },
        opacity: {
          value: 0.5,
          random: true,
          anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false }
        },
        size: {
          value: 3,
          random: true,
          anim: { enable: true, speed: 2, size_min: 0.1, sync: false }
        },
        move: {
          enable: true,
          speed: 0.5,
          direction: "none",
          random: true,
          straight: false,
          out_mode: "out",
          bounce: false,
        }
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: { enable: true, mode: "bubble" },
          onclick: { enable: false },
          resize: true
        },
        modes: {
          bubble: { distance: 200, size: 6, duration: 2, opacity: 0.8, speed: 3 }
        }
      },
      retina_detect: true
    });
  }


  // ==========================================
  // 3. ANIMATIONS GSAP
  // ==========================================
  gsap.registerPlugin(ScrollTrigger);

  // --- Animation du Hero (Séquence d'entrée) ---
  try {
    const heroTitle = document.querySelector('.gsap-hero-title');
    if (heroTitle && typeof SplitType !== 'undefined') {
      const splitTitle = new SplitType(heroTitle, { types: 'chars' });
      const tl = gsap.timeline();

    // Apparition du badge
    tl.fromTo('.hero__badge', 
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
    )
    // Apparition lettre par lettre du titre principal
    .fromTo(splitTitle.chars, 
      { opacity: 0, y: 50, rotateX: -90 },
      { opacity: 1, y: 0, rotateX: 0, stagger: 0.05, duration: 0.8, ease: "back.out(1.7)" },
      "-=0.4"
    )
    // Apparition du reste (sous-titre, date, bouton)
    .fromTo('.gsap-hero-reveal:not(.hero__badge)', 
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: "power3.out" },
      "-=0.2"
    );
    }
  } catch(e) {
    console.error("GSAP Hero animation error:", e);
  }

  // --- Parallaxe Image Héro (Lié au Scroll) ---
  const heroImage = document.querySelector('.hero__background img');
  if (heroImage) {
    gsap.to(heroImage, {
      yPercent: 30,
      scale: 1.1,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });
  }

  // --- Animation d'apparition des sections (Titres) ---
  const sectionTitles = document.querySelectorAll('.gsap-section-title');
  sectionTitles.forEach(title => {
    gsap.fromTo(title,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: title,
          start: "top 85%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });

  // --- Animation des Cartes en cascade (Stagger) ---
  const infoGrid = document.querySelector('.info-grid');
  if (infoGrid) {
    const cards = infoGrid.querySelectorAll('.gsap-card');
    gsap.fromTo(cards,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "back.out(1.2)",
        scrollTrigger: {
          trigger: infoGrid,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      }
    );
  }

  // --- Animation autres cartes individuelles ---
  const otherCards = document.querySelectorAll('.description-card.gsap-card, .price-card.gsap-card');
  otherCards.forEach(card => {
    gsap.fromTo(card,
      { opacity: 0, scale: 0.95, y: 40 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 85%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });


  // ==========================================
  // 4. AUTRES INTERACTIONS
  // ==========================================

  // Validation formulaire visuelle
  const form = document.getElementById('registration-form');
  if (form) {
    const inputs = form.querySelectorAll('input[required], select[required]');
    
    inputs.forEach(input => {
      input.addEventListener('blur', function() {
        if (!this.validity.valid) {
          this.style.borderColor = 'var(--color-error)';
        } else {
          this.style.borderColor = 'var(--color-border)';
        }
      });

      input.addEventListener('focus', function() {
        this.style.borderColor = 'var(--color-gold)';
      });
    });
  }

});
