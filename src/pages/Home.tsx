import Explorer from '../components/Explorer'
import { About, Footer, Header, Hero } from '../components/Site'
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Explorer />
        <About />
      </main>
      <Footer />
    </>
  )
}