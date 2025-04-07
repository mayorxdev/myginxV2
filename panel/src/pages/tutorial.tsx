import Layout from "@/components/Layout";

export default function Tutorial() {
  const tutorials = [
    {
      title: "Getting Started",
      description: "Learn how to set up and configure your environment.",
      videoUrl:
        "https://drive.google.com/file/d/1vXxP0eEW0kVkCLudae4OEEHi4vX2LY00/preview",
      // },
      // {
      //   title: "Basic Configuration",
      //   description: "Configure your basic settings and preferences.",
      //   videoUrl:
      //     "https://drive.google.com/file/d/13RgmmC3EXgIm3B8gE-_QDwr5ApJ1TEO_/preview",
      // },
      // {
      //   title: "Advanced Features",
      //   description: "Explore advanced features and customization options.",
      //   videoUrl:
      //     "https://drive.google.com/file/d/13RgmmC3EXgIm3B8gE-_QDwr5ApJ1TEO_/preview",
      // },
      // {
      //   title: "Security Settings",
      //   description: "Learn about security features and best practices.",
      //   videoUrl:
      //     "https://drive.google.com/file/d/13RgmmC3EXgIm3B8gE-_QDwr5ApJ1TEO_/preview",
      //
      // },
      // {
      //   title: "Troubleshooting",
      //   description: "Common issues and how to resolve them.",
      //   videoUrl:
      //     "https://drive.google.com/file/d/13RgmmC3EXgIm3B8gE-_QDwr5ApJ1TEO_/preview",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8 p-6">
        <h1 className="text-2xl font-bold text-white mb-8">Tutorials</h1>

        {tutorials.map((tutorial, index) => (
          <section
            key={index}
            className="bg-[#232A34] rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl text-white font-semibold">
              {tutorial.title}
            </h2>
            <p className="text-gray-400">{tutorial.description}</p>

            <div className="relative w-full pt-[56.25%] bg-[#1B2028] rounded-lg overflow-hidden">
              <iframe
                src={tutorial.videoUrl}
                className="absolute top-0 left-0 w-full h-full"
                allow="autoplay"
                frameBorder="0"
              />
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
}
