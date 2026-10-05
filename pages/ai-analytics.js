import Head from "next/head";
import Layout from "../components/Layout";
import MLResearchDashboard from "../components/MLResearchDashboard";

export default function AiAnalyticsPage() {
  return (
    <>
      <Head>
        <title>AI Model Metrics & Research | Polygon Transaction Failure Prediction</title>
        <meta
          name="description"
          content="Empirical evaluation and performance metrics for Polygon pre-transaction failure prediction models"
        />
      </Head>

      <Layout title="AI Analytics">
        <div className="space-y-6">
          {/* Comprehensive Polygon ML Research & Performance Evaluation Dashboard */}
          <section id="ml-research-evaluation">
            <MLResearchDashboard />
          </section>
        </div>
      </Layout>
    </>
  );
}