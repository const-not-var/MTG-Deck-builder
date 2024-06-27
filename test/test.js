const Deck = require("../models/Decks");
const chai = require("chai");

const chaiHttp = require("chai-http");
const app = require("../app");
chai.should();

chai.use(chaiHttp);

describe("Decks", () => {
  beforeEach((done) => {
    Deck.deleteMany({}, (err) => {
      done();
    });
  });
  describe("/GET deck", () => {
    it("it should GET all the decks", (done) => {
      chai
        .request(app)
        .get("/api/decks")
        .end((err, res) => {
          res.should.have.status(200);
          res.body.data.should.be.a("array");
          res.body.data.length.should.be.eql(0);
          done();
        });
    });
  });
  describe("/POST deck", () => {
    it("it should new POST a deck", (done) => {
      let deck = {
        title: "This is a new deck",
      };
      chai
        .request(app)
        .post("/api/decks")
        .send(deck)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.data.should.be.a("object");
          res.body.status.should.be.eql("success");
          done();
        });
    });
  });
  describe("/GET/:id deck", () => {
    it("it should GET a deck by the id", (done) => {
      let deck = new Deck({
        title: "This is a specific deck"
      });
      deck.save((err, deck) => {
        chai
          .request(app)
          .get("/api/decks/" + deck.id)
          .send(deck)
          .end((err, res) => {
            res.should.have.status(200);
            res.body.data.should.be.a("object");
            res.body.status.should.be.eql("success");
            done();
          });
      });
    });
  });
  describe("/PUT/:id deck", () => {
    it("it should UPDATE a deck given the id", (done) => {
      let deck = new Deck({
        title: "This is an updated deck"
      });
      deck.save((err, deck) => {
        console.log(deck.id);
        chai
          .request(app)
          .put("/api/decks/" + deck.id)
          .send({
            title: "The deck was updated"
          })
          .end((err, res) => {
            res.should.have.status(200);
            res.body.data.should.be.a("object");
            res.body.status.should.be.eql("success");
            done();
          });
      });
    });
  });
  describe("/DELETE/:id deck", () => {
    it("it should DELETE a deck given the id", (done) => {
      let deck = new Deck({
        title: "This is a deleted deck"
      });
      deck.save((err, deck) => {
        chai
          .request(app)
          .delete("/api/decks/" + deck.id)
          .end((err, res) => {
            res.should.have.status(200);
            res.body.data.should.be.a("object");
            res.body.status.should.be.eql("success");
            done();
          });
      });
    });
  });
});
