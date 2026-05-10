<script setup lang="ts">
definePageMeta({ layout: 'marketing' });
</script>

<template>
  <div class="legal-page">
    <div class="legal-header">
      <div class="legal-container">
        <h1 class="m-heading">Privacy Policy</h1>
        <p class="m-sub">Last updated: May 10, 2026</p>
      </div>
    </div>
    
    <div class="legal-container legal-content">
      <h2>1. Introduction</h2>
      <p>Welcome to Postfolio. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
      
      <h2>2. Data We Collect</h2>
      <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
      <ul>
        <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
        <li><strong>Contact Data</strong> includes billing address, delivery address, email address and telephone numbers.</li>
        <li><strong>Financial Data</strong> includes bank account and payment card details.</li>
        <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
      </ul>
      
      <h2>3. How We Use Your Data</h2>
      <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
      <ul>
        <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
        <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
        <li>Where we need to comply with a legal obligation.</li>
      </ul>
      
      <h2>4. Data Security</h2>
      <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know. They will only process your personal data on our instructions and they are subject to a duty of confidentiality.</p>
      
      <h2>5. Your Legal Rights</h2>
      <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data and (where the lawful ground of processing is consent) to withdraw consent.</p>
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

.legal-content li strong {
  color: #68293A;
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
