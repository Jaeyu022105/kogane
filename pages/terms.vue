<script setup lang="ts">
definePageMeta({ layout: 'marketing' });
</script>

<template>
  <div class="legal-page">
    <div class="legal-header">
      <div class="legal-container">
        <h1 class="m-heading">Terms of Service</h1>
        <p class="m-sub">Last updated: May 10, 2026</p>
      </div>
    </div>
    
    <div class="legal-container legal-content">
      <h2>1. Agreement to Terms</h2>
      <p>By accessing the website at Postfolio, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
      
      <h2>2. Use License</h2>
      <p>Permission is granted to temporarily download one copy of the materials (information or software) on Postfolio's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
      <ul>
        <li>modify or copy the materials;</li>
        <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
        <li>attempt to decompile or reverse engineer any software contained on Postfolio's website;</li>
        <li>remove any copyright or other proprietary notations from the materials; or</li>
        <li>transfer the materials to another person or "mirror" the materials on any other server.</li>
      </ul>
      <p>This license shall automatically terminate if you violate any of these restrictions and may be terminated by Postfolio at any time.</p>
      
      <h2>3. Disclaimer</h2>
      <p>The materials on Postfolio's website are provided on an 'as is' basis. Postfolio makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
      
      <h2>4. Limitations</h2>
      <p>In no event shall Postfolio or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Postfolio's website, even if Postfolio or a Postfolio authorized representative has been notified orally or in writing of the possibility of such damage.</p>

      <h2>5. Standard Plan Limits and Exclusions</h2>
      <p>Standard preset plans do not include fully customizable database modeling, direct UI editor access, source-code export, executable-code export, or bespoke runtime code unless those capabilities are explicitly included in a separate written agreement.</p>
      
      <h2>6. Revisions and Errata</h2>
      <p>The materials appearing on Postfolio's website could include technical, typographical, or photographic errors. Postfolio does not warrant that any of the materials on its website are accurate, complete or current. Postfolio may make changes to the materials contained on its website at any time without notice.</p>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  padding-bottom: 6rem;
}

.legal-header {
  background: linear-gradient(180deg, rgba(104, 41, 58, 0.03) 0%, transparent 100%);
  padding: 4rem 0 2.5rem;
  border-bottom: 1px solid rgba(104, 41, 58, 0.06);
  margin-bottom: 3rem;
}

.legal-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 2rem;
}

.legal-content h2 {
  font-family: 'DM Serif Display', serif;
  font-size: 1.6rem;
  color: #68293A;
  margin: 2.5rem 0 1rem;
}

.legal-content p {
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(104, 41, 58, 0.7);
  margin-bottom: 1.2rem;
}

.legal-content ul {
  padding-left: 1.5rem;
  margin-bottom: 1.5rem;
}

.legal-content li {
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(104, 41, 58, 0.7);
  margin-bottom: 0.5rem;
}

.m-heading {
  font-family: 'DM Serif Display', serif;
  font-size: 2.5rem;
  color: #68293A;
  margin-bottom: 0.5rem;
  font-weight: 400;
}

.m-sub {
  font-size: 1rem;
  color: rgba(104, 41, 58, 0.5);
  margin: 0;
}

@media (max-width: 768px) {
  .legal-header {
    padding: 3rem 0 2rem;
  }
  .m-heading {
    font-size: 2.2rem;
  }
  .legal-content h2 {
    font-size: 1.4rem;
  }
}
</style>
