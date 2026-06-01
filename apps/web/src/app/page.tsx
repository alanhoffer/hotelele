import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Flower2,
  Hexagon,
  Leaf,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Abeja Raíz | Apicultura natural",
  description:
    "Miel pura, cuidado de colmenas y experiencias de apicultura responsable.",
};

const products = [
  {
    name: "Miel multifloral",
    detail: "Cosecha de temporada, filtrada en frío y envasada sin aditivos.",
    price: "Desde Gs. 38.000",
  },
  {
    name: "Propóleo y cera",
    detail: "Insumos naturales para bienestar, velas artesanales y talleres.",
    price: "Lotes limitados",
  },
  {
    name: "Núcleos de colmena",
    detail: "Colonias sanas con reina marcada y acompañamiento inicial.",
    price: "Bajo reserva",
  },
];

const services = [
  "Instalación y manejo de apiarios",
  "Rescate seguro de enjambres",
  "Capacitaciones para nuevos apicultores",
  "Polinización para huertas y fincas",
];

const metrics = [
  ["120+", "colmenas cuidadas"],
  ["8", "variedades de floración"],
  ["0", "azúcar añadida"],
];

export default function HomePage() {
  return (
    <main className="apiary-site">
      <section className="apiary-hero" aria-label="Abeja Raiz">
        <nav className="apiary-nav" aria-label="Principal">
          <a className="apiary-logo" href="#inicio">
            <span>
              <Hexagon size={18} strokeWidth={2.4} />
            </span>
            Abeja Raíz
          </a>
          <div className="apiary-nav-links">
            <a href="#miel">Miel</a>
            <a href="#servicios">Servicios</a>
            <a href="#contacto">Contacto</a>
          </div>
        </nav>

        <div className="apiary-hero-content" id="inicio">
          <p className="apiary-kicker">
            <Sparkles size={16} />
            Apicultura responsable desde el campo
          </p>
          <h1>Miel pura y colmenas cuidadas con oficio</h1>
          <p className="apiary-lede">
            Producimos miel cruda de floraciones locales, acompañamos apiarios
            familiares y acercamos el mundo de las abejas a fincas, huertas y
            escuelas.
          </p>
          <div className="apiary-actions">
            <a className="apiary-button apiary-button-primary" href="#contacto">
              Hacer un pedido <ArrowRight size={18} />
            </a>
            <a className="apiary-button apiary-button-secondary" href="#servicios">
              Ver servicios
            </a>
          </div>
        </div>
      </section>

      <section className="apiary-metrics" aria-label="Datos del apiario">
        {metrics.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="apiary-section apiary-intro" id="miel">
        <div>
          <p className="apiary-kicker">
            <Flower2 size={16} />
            Cosecha local
          </p>
          <h2>Del panal al frasco, sin atajos.</h2>
        </div>
        <p>
          Trabajamos por temporadas, respetando el ritmo de cada colmena y la
          floración disponible. Cada lote se extrae con baja intervención para
          conservar aroma, textura y origen.
        </p>
      </section>

      <section className="apiary-products" aria-label="Productos de apicultura">
        {products.map((product) => (
          <article className="apiary-product-card" key={product.name}>
            <div className="apiary-product-icon">
              <Sun size={22} />
            </div>
            <h3>{product.name}</h3>
            <p>{product.detail}</p>
            <span>{product.price}</span>
          </article>
        ))}
      </section>

      <section className="apiary-band" id="servicios">
        <div className="apiary-band-media">
          <img
            alt="Apicultor revisando un marco de miel en una colmena"
            src="https://images.unsplash.com/photo-1498936178812-4b2e558d2937?auto=format&fit=crop&w=1200&q=82"
          />
        </div>
        <div className="apiary-band-copy">
          <p className="apiary-kicker">
            <ShieldCheck size={16} />
            Oficio y seguridad
          </p>
          <h2>Servicios para cuidar abejas, personas y cultivos.</h2>
          <div className="apiary-service-list">
            {services.map((service) => (
              <div key={service}>
                <BadgeCheck size={18} />
                <span>{service}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="apiary-process" aria-label="Proceso de trabajo">
        <div>
          <Leaf size={22} />
          <h3>Observamos</h3>
          <p>Revisamos floración, fuerza de la colonia y reservas de alimento.</p>
        </div>
        <div>
          <Sprout size={22} />
          <h3>Cuidamos</h3>
          <p>Manejamos espacio, sanidad y cosecha con intervenciones precisas.</p>
        </div>
        <div>
          <Hexagon size={22} />
          <h3>Cosechamos</h3>
          <p>Extraemos por lote para que cada frasco conserve su identidad.</p>
        </div>
      </section>

      <section className="apiary-contact" id="contacto">
        <div>
          <p className="apiary-kicker">
            <Mail size={16} />
            Pedidos y visitas
          </p>
          <h2>Reserva miel fresca o agenda una visita al apiario.</h2>
          <p>
            Atendemos pedidos por temporada, asesorías y rescates de enjambres
            en zonas cercanas.
          </p>
        </div>
        <div className="apiary-contact-panel">
          <a href="tel:+595981000000">
            <Phone size={18} />
            +595 981 000 000
          </a>
          <a href="mailto:hola@abejaraiz.com">
            <Mail size={18} />
            hola@abejaraiz.com
          </a>
          <span>
            <MapPin size={18} />
            Paraguay, entregas locales
          </span>
        </div>
      </section>
    </main>
  );
}
