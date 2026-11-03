import { Navigate } from "react-router-dom";
import { Boxes, ShoppingCart, BarChart3 } from "lucide-react";
import AuthModal from "../components/AuthModal";
import { useAuth } from "../context/AuthContext";
import "./Home.css";

const PUNTOS = [
  { icono: Boxes, texto: "Inventario por lotes con control de vencimientos" },
  { icono: ShoppingCart, texto: "Ventas con factura en PDF" },
  { icono: BarChart3, texto: "Reportes y alertas de stock" },
];

function Home() {
    const { usuario, cargando } = useAuth();

    // Si ya hay sesión activa, no tiene sentido volver a pedir credenciales
    if (!cargando && usuario) return <Navigate to="/dashboard" replace />;

    return (
        <div className="home">
            <section className="home__brand" aria-label="Herencia de Papá">
                <span className="home__blob home__blob--blue" aria-hidden="true" />
                <span className="home__blob home__blob--green" aria-hidden="true" />

                <div className="home__brand-inner">
                    <div className="home__wordmark">
                        <h1>Herencia de paapá</h1>
                    </div>
                    <p className="home__est">Est. 2010</p>

                    <ul className="home__points">
                        {PUNTOS.map(({ icono: Icono, texto }) => (
                            <li key={texto}>
                                <span><Icono size={16} /></span>
                                {texto}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <main className="home__form">
                <div className="home__form-brand">
                    <div className="home__wordmark home__wordmark--small">
                        <h1>Herencia de Papá</h1>
                    </div>
                </div>
                <AuthModal />
            </main>
        </div>
    );
}

export default Home;
