export const franchises = {
  "star-wars": {
    id: "star-wars",
    title: "Star Wars",
    summary: "Explora la épica saga de una galaxia muy, muy lejana. Desde el ascenso de la República hasta el conflicto final contra la Primera Orden, curamos cada momento en su orden temporal exacto.",
    items: [
      {
        id: "ep1",
        title: "Star Wars: Episodio I",
        releaseYear: "1999",
        description: "Dos caballeros Jedi escapan de un bloqueo hostil para encontrar aliados y descubren a un joven que puede traer el equilibrio a la Fuerza.",
        poster: "/images/posters/ep1.png",
        type: "Película",
        dotColor: "orange"
      },
      {
        id: "clone-wars",
        title: "The Clone Wars",
        releaseYear: "2008 - 2020",
        description: "Sigue las aventuras de Anakin Skywalker, Obi-Wan Kenobi y Ahsoka Tano durante el conflicto galáctico que definió el destino de la galaxia.",
        poster: "/images/posters/clone-wars.png",
        type: "Animación",
        dotColor: "purple"
      },
      {
        id: "ep3",
        title: "Episodio III - La Venganza de los Sith",
        releaseYear: "2005",
        description: "Tres años después de las Guerras Clon, los Jedi rescatan al Canciller Palpatine del Conde Dooku. Anakin se ve tentado por el lado oscuro.",
        poster: "/images/posters/ep3.png",
        type: "Película",
        dotColor: "orange"
      },
      {
        id: "obi-wan",
        title: "Obi-Wan Kenobi",
        releaseYear: "2022",
        description: "Diez años después de los eventos del Episodio III, el maestro Jedi exiliado vela por el joven Luke Skywalker mientras huye de los Inquisidores.",
        poster: "/images/posters/obi-wan.png",
        type: "Serie",
        dotColor: "orange"
      }
    ]
  },
  "lord-of-the-rings": {
    id: "lord-of-the-rings",
    title: "El Señor de los Anillos",
    summary: "Un viaje a través de la Tierra Media. Descubre el orden exacto para disfrutar del universo creado por J.R.R. Tolkien, desde la creación de los Anillos de Poder hasta el fin de la Tercera Edad.",
    items: [
      {
        id: "power-rings",
        title: "Los Anillos de Poder",
        releaseYear: "2022 - Actualidad",
        description: "Ambientada miles de años antes de los eventos de El Hobbit y El Señor de los Anillos, esta serie narra la forja de los Anillos y el resurgir del mal.",
        poster: "/images/posters/rings.png", // mock
        type: "Serie",
        dotColor: "purple"
      },
      {
        id: "hobbit",
        title: "El Hobbit (Trilogía)",
        releaseYear: "2012 - 2014",
        description: "Bilbo Bolsón es reclutado por el mago Gandalf para ayudar a trece enanos a recuperar su hogar y tesoro del dragón Smaug.",
        poster: "/images/posters/hobbit.png", // mock
        type: "Película",
        dotColor: "orange"
      },
      {
        id: "lotr",
        title: "El Señor de los Anillos (Trilogía)",
        releaseYear: "2001 - 2003",
        description: "El joven hobbit Frodo Bolsón hereda el Anillo Único y se embarca en una peligrosa misión para destruirlo en los fuegos del Monte del Destino.",
        poster: "/images/posters/lotr.png", // mock
        type: "Película",
        dotColor: "orange"
      }
    ]
  }
};
