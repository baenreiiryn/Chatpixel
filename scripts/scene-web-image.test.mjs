import assert from "node:assert/strict";
import test from "node:test";

const sceneWebImage = await import("../lib/sceneWebImage.ts");

test("scene image search prompt grounds the lookup in location and recent narration", () => {
  const prompt = sceneWebImage.buildSceneWebImageSearchPrompt({
    scene: "Viela dos Sinos · Distrito Velho",
    narration: "A chuva cobre os paralelepípedos e lanternas verdes balançam sobre as portas.",
    tone: "fantasia sombria",
  });
  assert.match(prompt, /Viela dos Sinos/);
  assert.match(prompt, /chuva cobre os paralelepípedos/);
  assert.match(prompt, /fantasia sombria/);
  assert.match(prompt, /ambiente|arquitetura|paisagem|interior/i);
});

test("scene image extraction accepts only HTTPS image results with a source page", () => {
  const response = {
    output: [{
      type: "web_search_call",
      results: [
        { type: "image_result", image_url: "http://unsafe.test/a.jpg", source_website_url: "https://unsafe.test/page" },
        {
          type: "image_result",
          image_url: "https://images.example.test/city.jpg",
          thumbnail_url: "https://images.example.test/city-thumb.jpg",
          source_website_url: "https://example.test/city",
          caption: "Rua antiga sob chuva",
        },
      ],
    }],
  };
  const image = sceneWebImage.extractSceneWebImage(response, "Cidade", "cidade medieval", "2026-10-21T00:00:00.000Z");
  assert.equal(image?.imageUrl, "https://images.example.test/city.jpg");
  assert.equal(image?.thumbnailUrl, "https://images.example.test/city-thumb.jpg");
  assert.equal(image?.sourceUrl, "https://example.test/city");
  assert.equal(image?.caption, "Rua antiga sob chuva");
});

test("scene image extraction returns null when the search produced no safe image", () => {
  assert.equal(sceneWebImage.extractSceneWebImage({ output: [{ type: "message" }] }, "Sala", "sala"), null);
});
