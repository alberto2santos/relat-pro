import { fontFamily } from 'tailwindcss/defaultTheme'
import animate from 'tailwindcss-animate'

const config = {
  // Modo escuro utilizando estratégia 'class'
  darkMode: ['class'],
  // Caminhos de content para todos os arquivos em src/**
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // Configuração do container responsivo
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      // Fonte family estendida com font-sans customizável
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
      // Cores estendidas baseadas em variáveis CSS do Shadcn/UI, com Slate como cor base implícita nos temas
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      // Bordas arredondadas customizadas
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Animações personalizadas: fadeIn, slideIn, slideUp, bounce
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounce: {
          '0%, 20%, 53%, 80%, 100%': {
            transform: 'translate3d(0,0,0)',
            animationTimingFunction: 'cubic-bezier(0.215,0.610,0.355,1.000)',
          },
          '40%, 43%': {
            transform: 'translate3d(0, -30px, 0)',
            animationTimingFunction: 'cubic-bezier(0.755,0.050,0.855,0.060)',
          },
          '70%': {
            transform: 'translate3d(0, -15px, 0)',
            animationTimingFunction: 'cubic-bezier(0.755,0.050,0.855,0.060)',
          },
          '90%': { transform: 'translate3d(0,-4px,0)' },
        },
      },
      // Definições das animações
      animation: {
        'fade-in': 'fade-in 0.5s ease-in-out',
        'slide-in': 'slide-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        bounce: 'bounce 1s infinite',
      },
      // Suporte a glassmorphism com backdrop-blur customizado
      backdropBlur: {
        xs: '2px',
        glass: '20px',
      },
      // Sombras industriais personalizadas
      boxShadow: {
        industrial: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'industrial-md': '0 20px 40px -12px rgba(0, 0, 0, 0.20)',
        'industrial-lg': '0 35px 60px -12px rgba(0, 0, 0, 0.30)',
        'industrial-xl': '0 50px 100px -12px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  // Plugin tailwindcss-animate para animações avançadas
  plugins: [animate],
}

export default config
